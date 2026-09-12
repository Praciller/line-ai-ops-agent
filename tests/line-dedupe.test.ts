import { describe, expect, it } from 'vitest';

import { InMemoryEventDeduper, type DeduplicationEvent } from '../src/line/dedupe.js';

const event: DeduplicationEvent = {
  eventId: 'evt-1',
  eventType: 'message',
  sourceIdHash: 'hash-1',
  receivedAt: '2026-09-12T00:00:00.000Z',
};

describe('InMemoryEventDeduper', () => {
  it('claims an event only once', async () => {
    const deduper = new InMemoryEventDeduper();
    expect(await deduper.claim(event)).toBe(true);
    expect(await deduper.claim(event)).toBe(false);
  });

  it('allows retry after a claim is released', async () => {
    const deduper = new InMemoryEventDeduper();
    await deduper.claim(event);
    await deduper.release(event.eventId);
    expect(await deduper.claim(event)).toBe(true);
  });

  it('evicts the oldest claim when bounded capacity is exceeded', async () => {
    const deduper = new InMemoryEventDeduper(2);
    const make = (eventId: string): DeduplicationEvent => ({ ...event, eventId });
    await deduper.claim(make('evt-1'));
    await deduper.claim(make('evt-2'));
    await deduper.claim(make('evt-3'));
    expect(await deduper.claim(make('evt-1'))).toBe(true);
    expect(await deduper.claim(make('evt-3'))).toBe(false);
  });
});