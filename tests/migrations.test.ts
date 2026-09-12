import { describe, expect, it } from 'vitest';
import { runMigrations, type Migration } from '../src/persistence/migrations.js';
import type { DatabaseExecutor, DatabasePool } from '../src/persistence/types.js';

class FakePool implements DatabasePool {
  readonly executed: string[] = [];
  readonly applied = new Set<string>();

  async query<T = unknown>(text: string, values: readonly unknown[] = []) {
    this.executed.push(text.trim());
    if (/select version from schema_migrations/i.test(text)) {
      return { rows: [...this.applied].map((version) => ({ version })) as T[] , rowCount: this.applied.size };
    }
    if (/insert into schema_migrations/i.test(text)) this.applied.add(String(values[0]));
    return { rows: [] as T[], rowCount: 0 };
  }

  async withTransaction<T>(work: (executor: DatabaseExecutor) => Promise<T>): Promise<T> {
    this.executed.push('BEGIN');
    try {
      const result = await work(this);
      this.executed.push('COMMIT');
      return result;
    } catch (error) {
      this.executed.push('ROLLBACK');
      throw error;
    }
  }

  async close(): Promise<void> {}
}

const migrations: Migration[] = [
  { version: '001', sql: 'CREATE TABLE alpha(id integer);' },
  { version: '002', sql: 'CREATE TABLE beta(id integer);' },
];

describe('runMigrations', () => {
  it('applies migrations in order and records each version', async () => {
    const pool = new FakePool();
    await runMigrations(pool, migrations);
    expect([...pool.applied]).toEqual(['001', '002']);
    expect(pool.executed.filter((sql) => sql === 'BEGIN')).toHaveLength(2);
  });

  it('does not reapply an already recorded migration', async () => {
    const pool = new FakePool();
    await runMigrations(pool, migrations);
    const firstCreates = pool.executed.filter((sql) => /^CREATE TABLE (alpha|beta)/i.test(sql)).length;
    await runMigrations(pool, migrations);
    const allCreates = pool.executed.filter((sql) => /^CREATE TABLE (alpha|beta)/i.test(sql)).length;
    expect(firstCreates).toBe(2);
    expect(allCreates).toBe(2);
  });
});