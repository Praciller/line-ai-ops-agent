import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { DatabasePool } from './types.js';

export type Migration = { version: string; sql: string };

const versionPattern = /^[0-9]{3,}$/;

export async function loadMigrations(directory: string): Promise<Migration[]> {
  const names = (await readdir(directory)).filter((name) => /^[0-9]+_.+\.sql$/.test(name)).sort();
  return Promise.all(names.map(async (name) => ({
    version: name.split('_', 1)[0] ?? '',
    sql: await readFile(path.join(directory, name), 'utf8'),
  })));
}

export async function runMigrations(pool: DatabasePool, migrations: readonly Migration[]): Promise<string[]> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const appliedResult = await pool.query<{ version: string }>('SELECT version FROM schema_migrations');
  const applied = new Set(appliedResult.rows.map((row) => row.version));
  const newlyApplied: string[] = [];

  for (const migration of [...migrations].sort((a, b) => a.version.localeCompare(b.version))) {
    if (!versionPattern.test(migration.version)) throw new Error('Migration version must be numeric');
    if (applied.has(migration.version)) continue;
    await pool.withTransaction(async (executor) => {
      await executor.query(migration.sql);
      await executor.query('INSERT INTO schema_migrations(version) VALUES($1)', [migration.version]);
    });
    newlyApplied.push(migration.version);
  }
  return newlyApplied;
}