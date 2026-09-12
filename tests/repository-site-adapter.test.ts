import { describe, expect, it } from 'vitest';

import { createRepositorySiteAdapter } from '../src/projects/repository-site.js';
import type { GitHubRepositoryReader } from '../src/projects/github.js';
import type { ProjectHttpClient } from '../src/projects/http.js';

function githubReader(fail = false): GitHubRepositoryReader {
  return {
    async getRepositorySummary(repo) {
      if (fail) throw new Error('github failed');
      return {
        repo,
        defaultBranch: 'main',
        pushedAt: null,
        openPullRequests: 1,
        openPullRequestsCapped: false,
        workflowState: 'success',
      };
    },
  };
}
function httpClient(status = 200): ProjectHttpClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async request(url) {
      calls.push(url);
      return new Response('', { status });
    },
  };
}

function buildAdapter(githubFails = false, siteStatus = 200) {
  const http = httpClient(siteStatus);
  return {
    http,
    adapter: createRepositorySiteAdapter({
      key: 'opendq',
      title: 'OpenDQ',
      repo: 'opendq-observatory',
      statusUrl: 'https://opendq-observatory.vercel.app/',
      github: githubReader(githubFails),
      http,
      now: () => new Date('2026-09-12T00:00:00.000Z'),
    }),
  };
}
describe('repository-site project adapter', () => {
  it('reports repository evidence plus site reachability without claiming app health', async () => {
    const { adapter, http } = buildAdapter(false, 200);

    const status = await adapter.getStatus();

    expect(status.state).toBe('ok');
    expect(status.summary).toBe('repository readable · site reachable');
    expect(status.details).toContain('Repository: main · PRs 1 · CI success');
    expect(status.details).toContain('Site: reachable');
    expect(http.calls).toEqual(['https://opendq-observatory.vercel.app/']);
  });

  it('degrades when the site is unreachable but repository evidence remains', async () => {
    const { adapter } = buildAdapter(false, 503);
    const status = await adapter.getStatus();
    expect(status.state).toBe('degraded');
    expect(status.details).toContain('Site: temporarily unavailable');
  });
  it('degrades when GitHub is unavailable but the site is reachable', async () => {
    const { adapter } = buildAdapter(true, 200);
    const status = await adapter.getStatus();
    expect(status.state).toBe('degraded');
    expect(status.details).toContain('Repository: temporarily unavailable');
    expect(status.details).toContain('Site: reachable');
  });

  it('reports unavailable only when both evidence sources fail', async () => {
    const { adapter } = buildAdapter(true, 503);
    const status = await adapter.getStatus();
    expect(status.state).toBe('unavailable');
    expect(status.summary).toBe('repository unavailable · site unavailable');
  });
});
