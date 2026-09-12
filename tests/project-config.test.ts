import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';

describe('project intelligence configuration', () => {
  it('uses the approved read-only project defaults', () => {
    const config = loadConfig({});

    expect(config.projects).toEqual({
      githubOwner: 'Praciller',
      githubRepos: ['line-ai-ops-agent', 'opendq-observatory', 'dreamlogsdata'],
      opendqUrl: 'https://opendq-observatory.vercel.app/',
      dreamlogsUrl: 'https://dreamlogsdata.com/',
      requestTimeoutMs: 4000,
      cacheTtlMs: 300000,
    });
  });

  it('accepts only repository slugs, never owner/repo paths', () => {
    expect(() => loadConfig({ PROJECT_GITHUB_REPOS: 'safe-repo,owner/other' }))
      .toThrow(/repository/i);
  });
  it('rejects non-HTTPS project status URLs', () => {
    expect(() => loadConfig({ OPENDQ_STATUS_URL: 'http://example.com/status' }))
      .toThrow(/https/i);
    expect(() => loadConfig({ DREAMLOGS_STATUS_URL: 'file:///tmp/status' }))
      .toThrow(/https/i);
  });

  it('bounds external request timeout and cache TTL', () => {
    expect(() => loadConfig({ PROJECT_HTTP_TIMEOUT_MS: '100' })).toThrow(/timeout/i);
    expect(() => loadConfig({ PROJECT_HTTP_TIMEOUT_MS: '20000' })).toThrow(/timeout/i);
    expect(() => loadConfig({ PROJECT_CACHE_TTL_MS: '1000' })).toThrow(/cache/i);
  });
});
