export type DeduplicationEvent = {
  eventId: string;
  eventType: 'message';
  sourceIdHash: string;
  receivedAt: string;
};

export interface EventDeduper {
  claim(event: DeduplicationEvent): Promise<boolean>;
  release(eventId: string): Promise<void>;
  markProcessed(eventId: string): Promise<void>;
}

export class InMemoryEventDeduper implements EventDeduper {
  private readonly claimed = new Map<string, true>();

  constructor(private readonly capacity = 10_000) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error('Event dedupe capacity must be a positive integer');
    }
  }

  async claim(event: DeduplicationEvent): Promise<boolean> {
    if (this.claimed.has(event.eventId)) return false;
    this.claimed.set(event.eventId, true);
    if (this.claimed.size > this.capacity) {
      const oldest = this.claimed.keys().next().value as string | undefined;
      if (oldest !== undefined) this.claimed.delete(oldest);
    }
    return true;
  }

  async release(eventId: string): Promise<void> {
    this.claimed.delete(eventId);
  }

  async markProcessed(_eventId: string): Promise<void> {}
}