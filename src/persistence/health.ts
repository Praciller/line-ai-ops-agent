import type { DatabaseExecutor } from './types.js';

export type DatabaseHealthState = 'ok' | 'unhealthy';

export async function checkDatabaseHealth(
  database: DatabaseExecutor,
): Promise<DatabaseHealthState> {
  try {
    await database.query('SELECT 1 AS ok');
    return 'ok';
  } catch {
    return 'unhealthy';
  }
}