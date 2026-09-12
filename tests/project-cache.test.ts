import { describe, expect, it } from 'vitest';

import { CachedProjectAdapter } from '../src/projects/cache.js';
import type { ProjectAdapter, ProjectStatus } from '../src/projects/types.js';

function status(summary: string): ProjectStatus {
  return {
    key: 'github',
    title: 'GitHub',
    state: 'ok',
    summary,
    details: [],
    capturedAt: '2026-09-12T00:00:00.000Z',
  };
}

describe('CachedProjectAdapter', () => {
  it('reuses a status until the TTL expires', async () => {
    let now = 1000;
    let calls = 0;
    const inner: ProjectAdapter = {
      async getStatus() {
        calls += 1;
        return status(`call-${calls}`);
      },
    };
    const cached = new CachedProjectAdapter(inner, 500, () => now);

    expect((await cached.getStatus()).summary).toBe('call-1');
    now = 1200;
    expect((await cached.getStatus()).summary).toBe('call-1');
    now = 1600;
    expect((await cached.getStatus()).summary).toBe('call-2');
    expect(calls).toBe(2);
  });
});
