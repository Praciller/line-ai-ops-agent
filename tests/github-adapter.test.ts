import { describe, expect, it } from 'vitest';

import {
  createGitHubProjectAdapter,
  createGitHubRepositoryReader,
} from '../src/projects/github.js';
import type { ProjectHttpClient } from '../src/projects/http.js';

class FakeHttpClient implements ProjectHttpClient {
  readonly calls: string[] = [];
  constructor(private readonly handler: (url: string) => Response | Promise<Response>) {}

  async request(url: string): Promise<Response> {
    this.calls.push(url);
    return this.handler(url);
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('GitHub project adapter', () => {
  it('summarizes repository metadata, open PRs, and latest workflow', async () => {
    const http = new FakeHttpClient((url) => {
      if (url.endsWith('/repos/Praciller/demo')) {
        return json({ name: 'demo', default_branch: 'main', pushed_at: '2026-09-12T10:00:00Z' });
      }
      if (url.includes('/pulls?')) return json([{ number: 1 }, { number: 2 }]);
      if (url.includes('/actions/runs?')) {
        return json({ workflow_runs: [{ status: 'completed', conclusion: 'success' }] });
      }
      return json({}, 404);
    });
    const adapter = createGitHubProjectAdapter({ owner: 'Praciller', repos: ['demo'], http });

    const status = await adapter.getStatus();

    expect(status.state).toBe('ok');
    expect(status.summary).toBe('1/1 repositories readable');
    expect(status.details[0]).toContain('demo: main · PRs 2 · CI success');
  });
  it('keeps successful repositories visible when one repository fails', async () => {
    const http = new FakeHttpClient((url) => {
      if (url.includes('/repos/Praciller/bad') && !url.includes('/pulls') && !url.includes('/actions')) {
        return json({ message: 'Not Found' }, 404);
      }
      if (url.match(/\/repos\/Praciller\/good$/)) {
        return json({ name: 'good', default_branch: 'main', pushed_at: null });
      }
      if (url.includes('/good/pulls?')) return json([]);
      if (url.includes('/good/actions/runs?')) return json({ workflow_runs: [] });
      return json({}, 404);
    });
    const adapter = createGitHubProjectAdapter({
      owner: 'Praciller',
      repos: ['good', 'bad'],
      http,
    });

    const status = await adapter.getStatus();

    expect(status.state).toBe('degraded');
    expect(status.summary).toBe('1/2 repositories readable');
    expect(status.details).toContain('bad: temporarily unavailable');
    expect(status.details.some((line) => line.startsWith('good: main'))).toBe(true);
  });

  it('rejects an unsafe repository name before any HTTP request', async () => {
    const http = new FakeHttpClient(() => json({}));
    const reader = createGitHubRepositoryReader({ owner: 'Praciller', http });

    await expect(reader.getRepositorySummary('../other')).rejects.toThrow(/repository/i);
    expect(http.calls).toHaveLength(0);
  });
});
