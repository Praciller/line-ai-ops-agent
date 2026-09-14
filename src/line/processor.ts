import type { webhook } from '@line/bot-sdk';

import type { AiAskService } from '../ai/ask.js';
import type { AppConfig } from '../config.js';
import { renderJobRadar } from '../jobs/render.js';
import type { JobRadar } from '../jobs/radar.js';
import {
  classifyAuditCommand,
  classifyAuditError,
  type CommandAudit,
  type CommandAuditInput,
} from '../persistence/audit.js';
import type { ProjectIntelligence } from '../projects/intelligence.js';
import { executeCommand, parseCommand, renderHelp, routeCommand } from './commands.js';
import type { EventDeduper } from './dedupe.js';
import { normalizeCommandEvent } from './events.js';
import type { LineReplyPort } from './reply.js';

type ProcessorDeps = {
  config: AppConfig;
  deduper: EventDeduper;
  reply: LineReplyPort;
  intelligence?: ProjectIntelligence;
  jobs?: JobRadar;
  ask?: AiAskService;
  status?: () => Promise<string>;
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
  providerUsed: string | null,
  error: unknown = null,
): CommandAuditInput {
  return {
    eventId,
    command,
    outcome,
    latencyMs: Math.max(0, finishedMs - startedMs),
    providerUsed,
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
    let providerUsed: string | null = null;
    try {
      let response: string | null;
      if (command === 'status' && deps.status) {
        response = await deps.status();
      } else if (command === 'jobs') {
        response = deps.jobs
          ? renderJobRadar(await deps.jobs.find())
          : 'Job radar unavailable';
      } else if (command === 'ask') {
        const parsed = parseCommand(normalized.text);
        if (parsed?.name !== 'ask' || !parsed.question || !deps.ask) {
          response = renderHelp();
        } else {
          const result = await deps.ask.ask(parsed.question);
          response = result.text;
          providerUsed = result.providerUsed;
        }
      } else {
        response = deps.intelligence
          ? await executeCommand(normalized.text, deps.config, deps.intelligence)
          : routeCommand(normalized.text, deps.config);
      }

      if (response === null) {
        await deps.deduper.markProcessed(normalized.eventId);
        const finishedMs = now();
        await safeAudit(
          deps.audit,
          auditInput(normalized.eventId, command, 'ignored', startedMs, finishedMs, providerUsed),
        );
        continue;
      }

      await deps.reply.reply(normalized.replyToken, response);
      await deps.deduper.markProcessed(normalized.eventId);
      const finishedMs = now();
      await safeAudit(
        deps.audit,
        auditInput(normalized.eventId, command, 'success', startedMs, finishedMs, providerUsed),
      );
    } catch (error) {
      await deps.deduper.release(normalized.eventId);
      const finishedMs = now();
      await safeAudit(
        deps.audit,
        auditInput(normalized.eventId, command, 'error', startedMs, finishedMs, providerUsed, error),
      );
      throw error;
    }
  }
}
