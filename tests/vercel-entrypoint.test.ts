import { readFile } from 'node:fs/promises';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

describe('Vercel Express entrypoint', () => {
  it('default-exports the existing Express application', async () => {
    const module = await import('../index.js');
    const response = await request(module.default).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      service: 'line-ai-ops-agent',
      status: 'ok',
    });
  });

  it('does not start a listening socket in the cloud entrypoint', async () => {
    const source = await readFile(new URL('../index.ts', import.meta.url), 'utf8');

    expect(source).not.toMatch(/\.listen\s*\(/);
    expect(source).toMatch(/export default/);
    expect(source).toMatch(/from ['"]express['"]/);
  });
});
