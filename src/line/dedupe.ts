export interface EventDeduper {
  claim(eventId: string): boolean;
  release(eventId: string): void;
}

export class InMemoryEventDeduper implements EventDeduper {
  private readonly claimed = new Map<string, true>();

  constructor(private readonly capacity = 10_000) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error('Event dedupe capacity must be a positive integer');
    }
  }

  claim(eventId: string): boolean {
    if (this.claimed.has(eventId)) return false;

    this.claimed.set(eventId, true);
    if (this.claimed.size > this.capacity) {
      const oldest = this.claimed.keys().next().value as string | undefined;
      if (oldest !== undefined) this.claimed.delete(oldest);
    }
    return true;
  }

  release(eventId: string): void {
    this.claimed.delete(eventId);
  }
}
