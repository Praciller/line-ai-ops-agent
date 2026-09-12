import type { webhook } from '@line/bot-sdk';
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';
import { InMemoryEventDeduper } from '../src/line/dedupe.js';
import { processWebhookEvents } from '../src/line/processor.js';
import type { LineReplyPort } from '../src/line/reply.js';
import {
  classifyAuditCommand,
  createPostgresCommandAudit,
  type CommandAudit,
  type CommandAuditInput,
} from '../src/persistence/audit.js';
import type { DatabaseExecutor } from '../src/persistence/types.js';

class FakeDatabase implements DatabaseExecutor {
  calls: Array<{ text: string; values: readonly unknown[] }> = [];
  async query<T = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
    this.calls.push({ text, values });
    return { rows: [] as T[], rowCount: 1 };
  }
}

class FakeReply implements LineReplyPort {
  calls: string[] = [];
  fail = false;
  async reply(_replyToken: string, text: string): Promise<void> {
    if (this.fail) throw new Error('secret reply failure details');
    this.calls.push(text);
  }
}

class FakeAudit implements CommandAudit {
  records: CommandAuditInput[] = [];
  fail = false;
  async record(input: CommandAuditInput): Promise<void> {
    if (this.fail) throw new Error('database audit unavailable');
    this.records.push(input);
  }
}

function config() {
  return loadConfig({ NODE_ENV: 'test', LINE_CHANNEL_SECRET: 'secret', LINE_CHANNEL_ACCESS_TOKEN: 'token', LINE_OWNER_USER_IDS: 'U-owner' });
}

function event(text: string, id = 'evt-1'): webhook.Event {
  return {
    type: 'message', mode: 'active', timestamp: 1, webhookEventId: id,
    deliveryContext: { isRedelivery: false }, source: { type: 'user', userId: 'U-owner' },
    replyToken: `reply-${id}`, message: { id: `msg-${id}`, type: 'text', text },
  } as webhook.Event;
}

function clock(...values: number[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

describe('command audit', () => {
  it('classifies only command names and maps unknown slash input to unknown', () => {
    expect(classifyAuditCommand('/TODAY')).toBe('today');
    expect(classifyAuditCommand('/secret raw arguments')).toBe('unknown');
    expect(classifyAuditCommand('ordinary chat')).toBeNull();
  });

  it('writes metadata-only command rows through parameterized SQL', async () => {
    const database = new FakeDatabase();
    const audit = createPostgresCommandAudit(database);
    await audit.record({
      eventId: 'evt-1', command: 'today', outcome: 'success', latencyMs: 25,
      providerUsed: null, errorClass: null,
      startedAt: '2026-09-12T00:00:00.000Z', finishedAt: '2026-09-12T00:00:00.025Z',
    });
    expect(database.calls[0]?.text).toMatch(/insert into command_runs/i);
    expect(database.calls[0]?.values).toContain('today');
    expect(database.calls[0]?.text).not.toMatch(/secret raw/i);
  });

  it('records a successful owner command without storing raw text', async () => {
    const reply = new FakeReply();
    const audit = new FakeAudit();
    await processWebhookEvents([event('/help')], {
      config: config(), deduper: new InMemoryEventDeduper(), reply, audit, now: clock(1000, 1025),
    });
    expect(audit.records).toHaveLength(1);
    expect(audit.records[0]).toMatchObject({ command: 'help', outcome: 'success', latencyMs: 25, errorClass: null });
  });

  it('records a stable error class without the exception message', async () => {
    const reply = new FakeReply();
    reply.fail = true;
    const audit = new FakeAudit();
    await expect(processWebhookEvents([event('/help')], {
      config: config(), deduper: new InMemoryEventDeduper(), reply, audit, now: clock(2000, 2010),
    })).rejects.toThrow(/secret reply failure/);
    expect(audit.records[0]?.outcome).toBe('error');
    expect(audit.records[0]?.errorClass).toBe('Error');
    expect(JSON.stringify(audit.records[0])).not.toContain('secret reply failure details');
  });

  it('audits unknown slash commands as unknown', async () => {
    const reply = new FakeReply();
    const audit = new FakeAudit();
    await processWebhookEvents([event('/do-something-dangerous')], {
      config: config(), deduper: new InMemoryEventDeduper(), reply, audit, now: clock(3000, 3001),
    });
    expect(audit.records[0]?.command).toBe('unknown');
  });

  it('does not fail a successful reply when audit persistence fails', async () => {
    const reply = new FakeReply();
    const audit = new FakeAudit();
    audit.fail = true;
    await expect(processWebhookEvents([event('/status')], {
      config: config(), deduper: new InMemoryEventDeduper(), reply, audit, now: clock(4000, 4001),
    })).resolves.toBeUndefined();
    expect(reply.calls).toHaveLength(1);
  });
});