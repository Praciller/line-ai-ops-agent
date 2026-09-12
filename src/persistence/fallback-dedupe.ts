import type { DeduplicationEvent, EventDeduper } from '../line/dedupe.js';

type Route = { target: EventDeduper; event: DeduplicationEvent };

export class ResilientEventDeduper implements EventDeduper {
  private readonly routes = new Map<string, Route>();

  constructor(
    private readonly primary: EventDeduper,
    private readonly fallback: EventDeduper,
  ) {}

  async claim(event: DeduplicationEvent): Promise<boolean> {
    try {
      const claimed = await this.primary.claim(event);
      if (claimed) this.routes.set(event.eventId, { target: this.primary, event });
      return claimed;
    } catch {
      const claimed = await this.fallback.claim(event);
      if (claimed) this.routes.set(event.eventId, { target: this.fallback, event });
      return claimed;
    }
  }

  async release(eventId: string): Promise<void> {
    const route = this.routes.get(eventId);
    try {
      await (route?.target ?? this.primary).release(eventId);
    } catch {
      if (route?.target === this.primary) await this.fallback.release(eventId);
    } finally {
      this.routes.delete(eventId);
    }
  }

  async markProcessed(eventId: string): Promise<void> {
    const route = this.routes.get(eventId);
    try {
      await (route?.target ?? this.primary).markProcessed(eventId);
    } catch {
      if (route?.target === this.primary) {
        await this.fallback.claim(route.event);
        await this.fallback.markProcessed(eventId);
      }
    } finally {
      this.routes.delete(eventId);
    }
  }
}