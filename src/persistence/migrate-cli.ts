import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '../config.js';
import { loadMigrations, runMigrations } from './migrations.js';
import { createPostgresPool } from './postgres.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  if (!config.database) throw new Error('DATABASE_URL is not configured');
  const pool = createPostgresPool(config.database);
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const directory = path.resolve(here, '../../migrations');
    const migrations = await loadMigrations(directory);
    const applied = await runMigrations(pool, migrations);
    process.stdout.write(`Applied ${applied.length} migration(s).\n`);
  } finally {
    await pool.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Database migration failed';
  process.stderr.write(`${message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]')}\n`);
  process.exitCode = 1;
});