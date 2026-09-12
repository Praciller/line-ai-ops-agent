import type { DatabaseExecutor } from './types.js';

export type AuditCommandName =
  | 'help'
  | 'status'
  | 'github'
  | 'opendq'
  | 'dreamlogs'
  | 'today'
  | 'unknown';

export type CommandOutcome = 'success' | 'ignored' | 'error';

export type CommandAuditInput = {
  eventId: string;
  command: AuditCommandName;
  outcome: CommandOutcome;
  latencyMs: number;
  providerUsed: string | null;
  errorClass: string | null;
  startedAt: string;
  finishedAt: string;
};

export interface CommandAudit {
  record(input: CommandAuditInput): Promise<void>;
}

const knownCommands = new Set<AuditCommandName>([
  'help', 'status', 'github', 'opendq', 'dreamlogs', 'today',
]);

export function classifyAuditCommand(text: string): AuditCommandName | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized.startsWith('/')) return null;
  const token = normalized.slice(1).split(/\s+/, 1)[0] ?? '';
  return knownCommands.has(token as AuditCommandName)
    ? token as AuditCommandName
    : 'unknown';
}

export function classifyAuditError(error: unknown): string {
  if (!(error instanceof Error)) return 'UnknownError';
  return /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(error.name)
    ? error.name
    : 'UnknownError';
}

export function createPostgresCommandAudit(database: DatabaseExecutor): CommandAudit {
  return {
    async record(input: CommandAuditInput): Promise<void> {
      const latencyMs = Math.max(0, Math.floor(input.latencyMs));
      await database.query(`
        INSERT INTO command_runs(
          event_id, command, outcome, latency_ms, provider_used, error_class, started_at, finished_at
        ) VALUES($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        input.eventId,
        input.command,
        input.outcome,
        latencyMs,
        input.providerUsed,
        input.errorClass,
        input.startedAt,
        input.finishedAt,
      ]);
    },
  };
}