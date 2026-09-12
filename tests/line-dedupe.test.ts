import { describe, expect, it } from 'vitest';

import { InMemoryEventDeduper } from '../src/line/dedupe.js';

describe('InMemoryEventDeduper', () => {
  it('claims an event only once', () => {
    const deduper = new InMemoryEventDeduper();

    expect(deduper.claim('evt-1')).toBe(true);
    expect(deduper.claim('evt-1')).toBe(false);
  });

  it('allows retry after a claim is released', () => {
    const deduper = new InMemoryEventDeduper();
    deduper.claim('evt-1');

    deduper.release('evt-1');

    expect(deduper.claim('evt-1')).toBe(true);
  });

  it('evicts the oldest claim when bounded capacity is exceeded', () => {
    const deduper = new InMemoryEventDeduper(2);
    deduper.claim('evt-1');
    deduper.claim('evt-2');
    deduper.claim('evt-3');

    expect(deduper.claim('evt-1')).toBe(true);
    expect(deduper.claim('evt-3')).toBe(false);
  });
});