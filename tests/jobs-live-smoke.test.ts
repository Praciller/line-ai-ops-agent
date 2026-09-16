import { afterEach, describe, expect, it, vi } from 'vitest';

import { runJobsLiveSmoke } from '../scripts/jobs-live-smoke.js';
import type { JobRadar } from '../src/jobs/radar.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('jobs live smoke', () => {
  it('uses an injected radar and prints only bounded sanitized summaries', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      logs.push(String(value));
    });
    const radar: JobRadar = {
      async find() {
        return {
          jobs: [],
          sources: [{ source: 'jobicy', outcome: 'success', count: 0, latencyMs: 12 }],
          generatedAt: '2026-09-15T00:00:00.000Z',
        };
      },
    };

    const exitCode = await runJobsLiveSmoke(radar);

    expect(exitCode).toBe(0);
    expect(logs.join('\n')).toContain('jobicy');
    expect(logs.join('\n')).toContain('No strong matches found right now');
    expect(logs.join('\n')).not.toContain('jobDescription');
  });
});
