import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('database configuration', () => {
  it('keeps persistence disabled when DATABASE_URL is absent', () => {
    expect(loadConfig({ NODE_ENV: 'test' }).database).toBeNull();
  });

  it('loads bounded PostgreSQL pool settings when configured', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:password@db.example.com/app?sslmode=require',
    });
    expect(config.database).toEqual({
      url: 'postgresql://user:password@db.example.com/app?sslmode=require',
      connectTimeoutMs: 3000,
      poolMax: 3,
    });
  });

  it('rejects unsafe database settings without echoing the URL', () => {
    const raw = 'postgresql://user:super-secret@db.example.com/app';
    expect(() => loadConfig({ NODE_ENV: 'test', DATABASE_URL: raw, DATABASE_POOL_MAX: '9' }))
      .toThrow(/pool/i);
    try { loadConfig({ NODE_ENV: 'test', DATABASE_URL: raw, DATABASE_POOL_MAX: '9' }); }
    catch (error) { expect(String(error)).not.toContain('super-secret'); }
  });

  it('rejects non-PostgreSQL URLs', () => {
    expect(() => loadConfig({ NODE_ENV: 'test', DATABASE_URL: 'https://db.example.com/app' }))
      .toThrow(/postgres/i);
  });
});