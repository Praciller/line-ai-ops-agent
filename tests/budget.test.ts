import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';
import { createMessageBudget } from '../src/persistence/budget.js';
import type { DatabaseExecutor, DatabasePool, DatabaseQueryResult } from '../src/persistence/types.js';

type BudgetRow = {
  chargeable_sends: number;
  proactive_day: string;
  proactive_day_sends: number;
};

class ScriptedPool implements DatabasePool {
  transactionCalls = 0;
  queries: Array<{ text: string; values: readonly unknown[] }> = [];

  constructor(private row: BudgetRow) {}

  async query<T = Record<string, unknown>>(): Promise<DatabaseQueryResult<T>> {
    throw new Error('budget must use transaction executor');
  }

  async withTransaction<T>(work: (executor: DatabaseExecutor) => Promise<T>): Promise<T> {
    this.transactionCalls += 1;
    const executor: DatabaseExecutor = {
      query: async <R>(text: string, values: readonly unknown[] = []) => {
        this.queries.push({ text, values });
        if (/select[\s\S]+from message_budget/i.test(text)) {
          return { rows: [this.row as R], rowCount: 1 };
        }
        return { rows: [] as R[], rowCount: 1 };
      },
    };
    return work(executor);
  }

  async close(): Promise<void> {}
}

describe('message budget configuration', () => {
  it('uses conservative default hard limits', () => {
    const config = loadConfig({ NODE_ENV: 'test' });
    expect(config.messageBudget).toEqual({
      monthlyHardLimit: 250,
      dailyProactiveHardLimit: 5,
    });
  });

  it('rejects non-positive or excessive configured limits', () => {
    expect(() => loadConfig({ NODE_ENV: 'test', MESSAGE_MONTHLY_HARD_LIMIT: '0' })).toThrow(/monthly/i);
    expect(() => loadConfig({ NODE_ENV: 'test', MESSAGE_DAILY_PROACTIVE_HARD_LIMIT: '301' })).toThrow(/daily/i);
  });
});

describe('atomic proactive budget', () => {
  const limits = { monthlyHardLimit: 250, dailyProactiveHardLimit: 5 };

  it('hard-stops at the monthly limit without updating usage', async () => {
    const pool = new ScriptedPool({ chargeable_sends: 250, proactive_day: '2026-09-13', proactive_day_sends: 0 });
    const budget = createMessageBudget(pool, limits);
    const result = await budget.reserveProactive(new Date('2026-09-13T01:00:00Z'), false);
    expect(result).toMatchObject({ allowed: false, reason: 'monthly_limit', monthlyUsed: 250 });
    expect(pool.queries.some((call) => /^\s*update message_budget/i.test(call.text))).toBe(false);
  });

  it('hard-stops at the daily proactive limit', async () => {
    const pool = new ScriptedPool({ chargeable_sends: 10, proactive_day: '2026-09-13', proactive_day_sends: 5 });
    const result = await createMessageBudget(pool, limits)
      .reserveProactive(new Date('2026-09-13T02:00:00Z'), false);
    expect(result).toMatchObject({ allowed: false, reason: 'daily_limit', dailyUsed: 5 });
  });

  it('resets daily usage when the UTC day changes and reserves one send', async () => {
    const pool = new ScriptedPool({ chargeable_sends: 10, proactive_day: '2026-09-12', proactive_day_sends: 5 });
    const result = await createMessageBudget(pool, limits)
      .reserveProactive(new Date('2026-09-13T00:01:00Z'), false);
    expect(result).toMatchObject({ allowed: true, reason: 'reserved', monthlyUsed: 11, dailyUsed: 1 });
    expect(pool.queries.some((call) => /^\s*update message_budget/i.test(call.text))).toBe(true);
  });

  it('supports dry-run without mutating counters', async () => {
    const pool = new ScriptedPool({ chargeable_sends: 10, proactive_day: '2026-09-13', proactive_day_sends: 2 });
    const result = await createMessageBudget(pool, limits)
      .reserveProactive(new Date('2026-09-13T03:00:00Z'), true);
    expect(result).toMatchObject({ allowed: true, reason: 'dry_run', monthlyUsed: 10, dailyUsed: 2 });
    expect(pool.queries.some((call) => /^\s*update message_budget/i.test(call.text))).toBe(false);
  });

  it('uses exactly one database transaction per reservation', async () => {
    const pool = new ScriptedPool({ chargeable_sends: 0, proactive_day: '2026-09-13', proactive_day_sends: 0 });
    await createMessageBudget(pool, limits).reserveProactive(new Date('2026-09-13T03:00:00Z'), false);
    expect(pool.transactionCalls).toBe(1);
    expect(pool.queries.some((call) => /for update/i.test(call.text))).toBe(true);
  });
});