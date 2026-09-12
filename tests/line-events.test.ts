import type { webhook } from '@line/bot-sdk';
import { describe, expect, it } from 'vitest';

import { normalizeCommandEvent } from '../src/line/events.js';

function textEvent(overrides: Record<string, unknown> = {}): webhook.Event {
  return {
    type: 'message',
    mode: 'active',
    timestamp: 1,
    webhookEventId: 'evt-1',
    deliveryContext: { isRedelivery: false },
    source: { type: 'user', userId: 'U-owner' },
    replyToken: 'reply-token',
    message: { type: 'text', id: 'msg-1', text: '/help', quoteToken: 'quote' },
    ...overrides,
  } as webhook.Event;
}

describe('normalizeCommandEvent', () => {
  it('normalizes an active owner text message shape', () => {
    expect(normalizeCommandEvent(textEvent())).toEqual({
      eventId: 'evt-1', userId: 'U-owner', replyToken: 'reply-token', text: '/help',
    });
  });

  it('ignores standby events', () => {
    expect(normalizeCommandEvent(textEvent({ mode: 'standby' }))).toBeNull();
  });
  it('ignores non-text message events', () => {
    expect(normalizeCommandEvent(textEvent({
      message: { type: 'image', id: 'img-1', quoteToken: 'quote' },
    }))).toBeNull();
  });

  it('ignores events without a source user ID', () => {
    expect(normalizeCommandEvent(textEvent({
      source: { type: 'group', groupId: 'group-1' },
    }))).toBeNull();
  });
});
