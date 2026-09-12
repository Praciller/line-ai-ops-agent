import type { webhook } from '@line/bot-sdk';
import { describe, expect, it } from 'vitest';

import { normalizeCommandEvent } from '../src/line/events.js';
import { hashSourceId } from '../src/security/hash.js';

function textEvent(overrides: Record<string, unknown> = {}): webhook.Event {
  return {
    type: 'message', mode: 'active', timestamp: 1, webhookEventId: 'evt-1',
    deliveryContext: { isRedelivery: false },
    source: { type: 'user', userId: 'U-owner' },
    replyToken: 'reply-token',
    message: { type: 'text', id: 'msg-1', text: '/help', quoteToken: 'quote' },
    ...overrides,
  } as webhook.Event;
}

describe('source hashing', () => {
  it('returns deterministic lowercase SHA-256 without exposing the raw ID', () => {
    expect(hashSourceId('U-owner')).toBe('faacda7b0913f734478144a7814b7d3322937f2811c4967e80a0794e6b2546ce');
  });
});

describe('normalizeCommandEvent', () => {
  it('normalizes persistence-safe event metadata', () => {
    expect(normalizeCommandEvent(textEvent())).toEqual({
      eventId: 'evt-1', eventType: 'message', userId: 'U-owner',
      sourceIdHash: 'faacda7b0913f734478144a7814b7d3322937f2811c4967e80a0794e6b2546ce',
      receivedAt: '1970-01-01T00:00:00.001Z', replyToken: 'reply-token', text: '/help',
    });
  });

  it('ignores standby events', () => {
    expect(normalizeCommandEvent(textEvent({ mode: 'standby' }))).toBeNull();
  });

  it('ignores non-text message events', () => {
    expect(normalizeCommandEvent(textEvent({ message: { type: 'image', id: 'img-1', quoteToken: 'quote' } }))).toBeNull();
  });

  it('ignores events without a source user ID', () => {
    expect(normalizeCommandEvent(textEvent({ source: { type: 'group', groupId: 'group-1' } }))).toBeNull();
  });
});