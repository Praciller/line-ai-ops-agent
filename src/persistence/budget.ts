import type { MessageBudgetConfig } from '../config.js';
import type { DatabasePool } from './types.js';

export type BudgetReason = 'reserved' | 'dry_run' | 'monthly_limit' | 'daily_limit';

export type BudgetReservation = {
  allowed: boolean;
  reason: BudgetReason;
  monthlyUsed: number;
  dailyUsed: number;
  monthlyHardLimit: number;
  dailyProactiveHardLimit: number;
};

export interface MessageBudget {
  reserveProactive(at: Date, dryRun: boolean): Promise<BudgetReservation>;
}

type BudgetRow = {
  chargeable_sends: number;
  proactive_day: string | Date;
  proactive_day_sends: number;
};

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function monthStart(value: Date): string {
  return `${value.toISOString().slice(0, 7)}-01`;
}

function normalizeDate(value: string | Date): string {
  return value instanceof Date ? dateKey(value) : String(value).slice(0, 10);
}

export function createMessageBudget(
  pool: DatabasePool,
  limits: MessageBudgetConfig,
): MessageBudget {
  return {
    async reserveProactive(at: Date, dryRun: boolean): Promise<BudgetReservation> {
      const month = monthStart(at);
      const day = dateKey(at);
      return pool.withTransaction(async (database) => {
        await database.query(`
          INSERT INTO message_budget(
            month_start, chargeable_sends, monthly_hard_limit,
            proactive_day, proactive_day_sends, daily_hard_limit
          ) VALUES($1::date, 0, $2, $3::date, 0, $4)
          ON CONFLICT (month_start) DO NOTHING
        `, [month, limits.monthlyHardLimit, day, limits.dailyProactiveHardLimit]);

        const selected = await database.query<BudgetRow>(`
          SELECT chargeable_sends, proactive_day, proactive_day_sends
          FROM message_budget
          WHERE month_start = $1::date
          FOR UPDATE
        `, [month]);
        const row = selected.rows[0];
        if (!row) throw new Error('Message budget row unavailable');

        const monthlyUsed = Number(row.chargeable_sends);
        const dailyUsed = normalizeDate(row.proactive_day) === day
          ? Number(row.proactive_day_sends)
          : 0;
        const base = {
          monthlyUsed,
          dailyUsed,
          monthlyHardLimit: limits.monthlyHardLimit,
          dailyProactiveHardLimit: limits.dailyProactiveHardLimit,
        };

        if (monthlyUsed >= limits.monthlyHardLimit) {
          return { allowed: false, reason: 'monthly_limit', ...base };
        }
        if (dailyUsed >= limits.dailyProactiveHardLimit) {
          return { allowed: false, reason: 'daily_limit', ...base };
        }
        if (dryRun) {
          return { allowed: true, reason: 'dry_run', ...base };
        }

        await database.query(`
          UPDATE message_budget
          SET chargeable_sends = chargeable_sends + 1,
              monthly_hard_limit = $3,
              proactive_day = $2::date,
              proactive_day_sends = CASE
                WHEN proactive_day = $2::date THEN proactive_day_sends + 1
                ELSE 1
              END,
              daily_hard_limit = $4,
              updated_at = now()
          WHERE month_start = $1::date
        `, [month, day, limits.monthlyHardLimit, limits.dailyProactiveHardLimit]);

        return {
          allowed: true,
          reason: 'reserved',
          monthlyUsed: monthlyUsed + 1,
          dailyUsed: dailyUsed + 1,
          monthlyHardLimit: limits.monthlyHardLimit,
          dailyProactiveHardLimit: limits.dailyProactiveHardLimit,
        };
      });
    },
  };
}