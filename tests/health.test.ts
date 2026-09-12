import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('GET /health', () => {
  it('reports the Phase 1 service state without external dependencies', async () => {
    const app = createApp(loadConfig({ NODE_ENV: 'test' }));

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.type).toMatch(/json/);
    expect(response.body).toEqual({
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
});
