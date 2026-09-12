import { describe, expect, it } from 'vitest';

import type { DeduplicationEvent, EventDeduper } from '../src/line/dedupe.js';
import { ResilientEventDeduper } from '../src/persistence/fallback-dedupe.js';
import { createPostgresEventDeduper } from '../src/persistence/event-ledger.js';
import type { DatabaseExecutor } from '../src/persistence/types.js';

const event: DeduplicationEvent = {
  eventId: 'evt-1', eventType: 'message', sourceIdHash: 'hash-1', receivedAt: '2026-09-12T00:00:00.000Z',
};

class FakeExecutor implements DatabaseExecutor {
  readonly calls: Array<{ text: string; values: readonly unknown[] }> = [];
  nextRowCount = 1;
  async query<T = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
    this.calls.push({ text, values });
    return { rows: [] as T[], rowCount: this.nextRowCount };
  }
}

class FakeDeduper implements EventDeduper {
  claimCalls = 0;
  releaseCalls = 0;
  processedCalls = 0;
  claimResult: boolean | Error = true;
  async claim(): Promise<boolean> { this.claimCalls += 1; if (this.claimResult instanceof Error) throw this.claimResult; return this.claimResult; }
  async release(): Promise<void> { this.releaseCalls += 1; }
  async markProcessed(): Promise<void> { this.processedCalls += 1; }
}

describe('Postgres event dedupe', () => {
  it('claims only when INSERT returns a row and never stores a raw user ID', async () => {
    const db = new FakeExecutor();
    const deduper = createPostgresEventDeduper(db);
    expect(await deduper.claim(event)).toBe(true);
    expect(db.calls[0]?.text).toMatch(/on conflict/i);
    expect(db.calls[0]?.values).toEqual(['evt-1', 'message', 'hash-1', '2026-09-12T00:00:00.000Z']);
    db.nextRowCount = 0;
    expect(await deduper.claim(event)).toBe(false);
  });

  it('releases processing claims and marks completed claims processed', async () => {
    const db = new FakeExecutor();
    const deduper = createPostgresEventDeduper(db);
    await deduper.release('evt-1');
    await deduper.markProcessed('evt-1');
    expect(db.calls[0]?.text).toMatch(/delete from line_events/i);
    expect(db.calls[1]?.text).toMatch(/processed/i);
  });
});

describe('ResilientEventDeduper', () => {
  it('falls back only when the primary throws', async () => {
    const primary = new FakeDeduper();
    const fallback = new FakeDeduper();
    primary.claimResult = new Error('database unavailable');
    const deduper = new ResilientEventDeduper(primary, fallback);
    expect(await deduper.claim(event)).toBe(true);
    expect(fallback.claimCalls).toBe(1);
    await deduper.release(event.eventId);
    expect(fallback.releaseCalls).toBe(1);
  });

  it('never overrides a durable duplicate with fallback execution', async () => {
    const primary = new FakeDeduper();
    const fallback = new FakeDeduper();
    primary.claimResult = false;
    const deduper = new ResilientEventDeduper(primary, fallback);
    expect(await deduper.claim(event)).toBe(false);
    expect(fallback.claimCalls).toBe(0);
  });
});