import { Pool } from 'pg';

import type { DatabaseConfig } from '../config.js';
import type { DatabaseExecutor, DatabasePool, DatabaseQueryResult } from './types.js';

function mapResult<T>(result: { rows: unknown[]; rowCount: number | null }): DatabaseQueryResult<T> {
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
}

export function createPostgresPool(config: DatabaseConfig): DatabasePool {
  const pool = new Pool({
    connectionString: config.url,
    connectionTimeoutMillis: config.connectTimeoutMs,
    max: config.poolMax,
    idleTimeoutMillis: 10_000,
  });

  return {
    async query<T>(text: string, values: readonly unknown[] = []) {
      return mapResult<T>(await pool.query(text, [...values]));
    },
    async withTransaction<T>(work: (executor: DatabaseExecutor) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      const executor: DatabaseExecutor = {
        async query<R>(text: string, values: readonly unknown[] = []) {
          return mapResult<R>(await client.query(text, [...values]));
        },
      };
      try {
        await client.query('BEGIN');
        const result = await work(executor);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}