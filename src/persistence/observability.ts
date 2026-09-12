import type { ProjectStatus } from '../projects/types.js';
import type { DatabaseExecutor } from './types.js';

export type DailyDigestInput = {
  date: string;
  deterministicDigest: string;
  aiEnhancedDigest: string | null;
};

export type ProviderOutcomeInput = {
  provider: string;
  model: string | null;
  outcome: string;
  latencyMs: number;
  errorClass: string | null;
  recordedAt: string;
};

export interface ObservabilityStore {
  saveProjectSnapshot(status: ProjectStatus): Promise<void>;
  saveDailyDigest(input: DailyDigestInput): Promise<void>;
  recordProviderOutcome(input: ProviderOutcomeInput): Promise<void>;
}

export function createPostgresObservabilityStore(
  database: DatabaseExecutor,
): ObservabilityStore {
  return {
    async saveProjectSnapshot(status: ProjectStatus): Promise<void> {
      await database.query(`
        INSERT INTO project_snapshots(project_key, normalized_status, captured_at)
        VALUES($1, $2::jsonb, $3)
      `, [status.key, JSON.stringify(status), status.capturedAt]);
    },

    async saveDailyDigest(input: DailyDigestInput): Promise<void> {
      await database.query(`
        INSERT INTO daily_digests(digest_date, deterministic_digest, ai_enhanced_digest)
        VALUES($1, $2, $3)
        ON CONFLICT (digest_date) DO UPDATE
        SET deterministic_digest = EXCLUDED.deterministic_digest,
            ai_enhanced_digest = EXCLUDED.ai_enhanced_digest,
            updated_at = now()
      `, [input.date, input.deterministicDigest, input.aiEnhancedDigest]);
    },

    async recordProviderOutcome(input: ProviderOutcomeInput): Promise<void> {
      await database.query(`
        INSERT INTO provider_outcomes(provider, model, outcome, latency_ms, error_class, recorded_at)
        VALUES($1, $2, $3, $4, $5, $6)
      `, [
        input.provider,
        input.model,
        input.outcome,
        Math.max(0, Math.floor(input.latencyMs)),
        input.errorClass,
        input.recordedAt,
      ]);
    },
  };
}