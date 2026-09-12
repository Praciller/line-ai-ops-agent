import type { webhook } from '@line/bot-sdk';

import type { AppConfig } from '../config.js';
import { routeCommand } from './commands.js';
import type { EventDeduper } from './dedupe.js';
import { normalizeCommandEvent } from './events.js';
import type { LineReplyPort } from './reply.js';

type ProcessorDeps = {
  config: AppConfig;
  deduper: EventDeduper;
  reply: LineReplyPort;
};

export async function processWebhookEvents(
  events: readonly webhook.Event[],
  deps: ProcessorDeps,
): Promise<void> {
  const line = deps.config.line;
  if (!line) return;

  for (const event of events) {
    const normalized = normalizeCommandEvent(event);
    if (!normalized) continue;
    if (!line.ownerUserIds.includes(normalized.userId)) continue;

    const response = routeCommand(normalized.text, deps.config);
    if (response === null) continue;
    if (!deps.deduper.claim(normalized.eventId)) continue;

    try {
      await deps.reply.reply(normalized.replyToken, response);
    } catch (error) {
      deps.deduper.release(normalized.eventId);
      throw error;
    }
  }
}
