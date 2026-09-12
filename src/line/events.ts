import type { webhook } from '@line/bot-sdk';

export type NormalizedCommandEvent = {
  eventId: string;
  userId: string;
  replyToken: string;
  text: string;
};

export function normalizeCommandEvent(event: webhook.Event): NormalizedCommandEvent | null {
  if (event.mode !== 'active' || event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const source = event.source;
  if (!source) return null;
  const userId = 'userId' in source ? source.userId : undefined;
  if (!userId || !event.replyToken || !event.webhookEventId) return null;

  return {
    eventId: event.webhookEventId,
    userId,
    replyToken: event.replyToken,
    text: event.message.text,
  };
}
