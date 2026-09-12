import type { DeduplicationEvent, EventDeduper } from '../line/dedupe.js';
import type { DatabaseExecutor } from './types.js';

export function createPostgresEventDeduper(database: DatabaseExecutor): EventDeduper {
  return {
    async claim(event: DeduplicationEvent): Promise<boolean> {
      const result = await database.query<{ event_id: string }>(`
        INSERT INTO line_events(event_id, event_type, source_id_hash, received_at, processing_status, updated_at)
        VALUES($1, $2, $3, $4, 'processing', now())
        ON CONFLICT (event_id) DO NOTHING
        RETURNING event_id
      `, [event.eventId, event.eventType, event.sourceIdHash, event.receivedAt]);
      return result.rowCount === 1;
    },
    async release(eventId: string): Promise<void> {
      await database.query(`
        DELETE FROM line_events
        WHERE event_id = $1 AND processing_status = 'processing'
      `, [eventId]);
    },
    async markProcessed(eventId: string): Promise<void> {
      await database.query(`
        UPDATE line_events
        SET processing_status = 'processed', updated_at = now()
        WHERE event_id = $1 AND processing_status = 'processing'
      `, [eventId]);
    },
  };
}