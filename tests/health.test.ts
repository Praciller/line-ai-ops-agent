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