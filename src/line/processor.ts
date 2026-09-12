import type { webhook } from '@line/bot-sdk';

import type { AppConfig } from '../config.js';
import {
  classifyAuditCommand,
  classifyAuditError,
  type CommandAudit,
  type CommandAuditInput,
} from '../persistence/audit.js';
import type { ProjectIntelligence } from '../projects/intelligence.js';
import { executeCommand, routeCommand } from './commands.js';
import type { EventDeduper } from './dedupe.js';
import { normalizeCommandEvent } from './events.js';
import type { LineReplyPort } from './reply.js';

type ProcessorDeps = {
  config: AppConfig;
  deduper: EventDeduper;
  reply: LineReplyPort;
  intelligence?: ProjectIntelligence;
  audit?: CommandAudit;
  now?: () => number;
};

async function safeAudit(audit: CommandAudit | undefined, input: CommandAuditInput): Promise<void> {
  if (!audit) return;
  try {
    await audit.record(input);
  } catch {
    // Observability is best-effort and must not block owner commands.
  }
}

function auditInput(
  eventId: string,
  command: NonNullable<ReturnType<typeof classifyAuditCommand>>,
  outcome: CommandAuditInput['outcome'],
  startedMs: number,
  finishedMs: number,
  error: unknown = null,
): CommandAuditInput {
  return {
    eventId,
    command,
    outcome,
    latencyMs: Math.max(0, finishedMs - startedMs),
    providerUsed: null,
    errorClass: outcome === 'error' ? classifyAuditError(error) : null,
    startedAt: new Date(startedMs).toISOString(),
    finishedAt: new Date(finishedMs).toISOString(),
  };
}

export async function processWebhookEvents(
  events: readonly webhook.Event[],
  deps: ProcessorDeps,
): Promise<void> {
  const line = deps.config.line;
  if (!line) return;
  const now = deps.now ?? Date.now;

  for (const event of events) {
    const normalized = normalizeCommandEvent(event);
    if (!normalized) continue;
    if (!line.ownerUserIds.includes(normalized.userId)) continue;

    const command = classifyAuditCommand(normalized.text);
    if (!command) continue;
    if (!(await deps.deduper.claim(normalized))) continue;

    const startedMs = now();
    try {
      const response = deps.intelligence
        ? await executeCommand(normalized.text, deps.config, deps.intelligence)
        : routeCommand(normalized.text, deps.config);

      if (response === null) {
        await deps.deduper.markProcessed(normalized.eventId);
        const finishedMs = now();
        await safeAudit(
          deps.audit,
          auditInput(normalized.eventId, command, 'ignored', startedMs, finishedMs),
        );
        continue;
      }

      await deps.reply.reply(normalized.replyToken, response);
      await deps.deduper.markProcessed(normalized.eventId);
      const finishedMs = now();
      await safeAudit(
        deps.audit,
        auditInput(normalized.eventId, command, 'success', startedMs, finishedMs),
      );
    } catch (error) {
      await deps.deduper.release(normalized.eventId);
      const finishedMs = now();
      await safeAudit(
        deps.audit,
        auditInput(normalized.eventId, command, 'error', startedMs, finishedMs, error),
      );
      throw error;
    }
  }
}