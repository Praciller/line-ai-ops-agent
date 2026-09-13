import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('GET /health', () => {
  it('reports LINE as not configured by default', async () => {
    const app = createApp(loadConfig({ NODE_ENV: 'test' }));

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      service: 'line-ai-ops-agent',
      status: 'ok',
      mode: 'dry-run',
      components: {
        line: 'not_configured',
        database: 'not_configured',
        ai: 'not_configured',
      },
    });
  });

  it('reports LINE as configured when complete LINE config is present', async () => {
    const app = createApp(loadConfig({      NODE_ENV: 'test',
      LINE_CHANNEL_SECRET: 'channel-secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'access-token',
      LINE_OWNER_USER_IDS: 'U-owner',
    }));

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.components).toEqual({
      line: 'configured',
      database: 'not_configured',
      ai: 'not_configured',
    });
  });
});
class HealthPool {
  constructor(private readonly healthy: boolean) {}
  async query<T = Record<string, unknown>>() {
    if (!this.healthy) throw new Error('database unavailable');
    return { rows: [{ ok: 1 } as T], rowCount: 1 };
  }
  async withTransaction<T>(): Promise<T> { throw new Error('unused'); }
  async close(): Promise<void> {}
}

describe('database-aware health', () => {
  const databaseConfig = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://user:password@db.example.com/app?sslmode=require',
  } as const;

  it('reports configured database as ok when the probe succeeds', async () => {
    const app = createApp(loadConfig(databaseConfig), { databasePool: new HealthPool(true) });
    const response = await request(app).get('/health');
    expect(response.body.status).toBe('ok');
    expect(response.body.components.database).toBe('ok');
  });

  it('degrades service health when the configured database probe fails', async () => {
    const app = createApp(loadConfig(databaseConfig), { databasePool: new HealthPool(false) });
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('degraded');
    expect(response.body.components.database).toBe('unhealthy');
  });
});

describe('AI-aware health', () => {
  it('reports AI configured when a free provider key is present without degrading service health', async () => {
    const app = createApp(loadConfig({ NODE_ENV: 'test', OPENROUTER_API_KEY: 'test-only-key' }));
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.components.ai).toBe('configured');
    expect(JSON.stringify(response.body)).not.toContain('test-only-key');
  });
});
