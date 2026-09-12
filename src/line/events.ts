import type { webhook } from '@line/bot-sdk';

import { hashSourceId } from '../security/hash.js';

export type NormalizedCommandEvent = {
  eventId: string;
  eventType: 'message';
  userId: string;
  sourceIdHash: string;
  receivedAt: string;
  replyToken: string;
  text: string;
};

export function normalizeCommandEvent(event: webhook.Event): NormalizedCommandEvent | null {
  if (event.mode !== 'active' || event.type !== 'message' || event.message.type !== 'text') return null;
  const source = event.source;
  if (!source) return null;
  const userId = 'userId' in source ? source.userId : undefined;
  if (!userId || !event.replyToken || !event.webhookEventId) return null;

  return {
    eventId: event.webhookEventId,
    eventType: 'message',
    userId,
    sourceIdHash: hashSourceId(userId),
    receivedAt: new Date(event.timestamp).toISOString(),
    replyToken: event.replyToken,
    text: event.message.text,
  };
}