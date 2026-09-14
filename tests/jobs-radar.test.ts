import { describe, expect, it } from 'vitest';

import { createJobRadarFromDefaults } from '../src/jobs/factory.js';
import { createJobRadar } from '../src/jobs/radar.js';
import type { JobSourceAdapter } from '../src/jobs/adapters/types.js';
import type { JobListing, JobSource, JobSourceBatch } from '../src/jobs/types.js';

const NOW = Date.parse('2026-09-15T00:00:00Z');

function listing(source: JobSource, id: string, title = 'AI Engineer'): JobListing {
  return {
    source,
    sourceId: id,
    title,
    company: `${source}-company`,
    location: 'Worldwide',
    remoteScope: 'Worldwide',
    employmentType: 'Full-time',
    salary: null,
    postedAt: '2026-09-14T00:00:00Z',
    tags: ['Python'],
    url: `https://example.com/${source}/${id}`,
  };
}

function ok(source: JobSource, jobs: JobListing[], calls: { value: number }): JobSourceAdapter {
  return {
    source,
    async fetch(): Promise<JobSourceBatch> {
      calls.value += 1;
      return { source, jobs, fetchedAt: new Date(NOW).toISOString() };
    },
  };
}
function fail(source: JobSource, error: Error = new Error('upstream failed')): JobSourceAdapter {
  return {
    source,
    async fetch(): Promise<JobSourceBatch> {
      throw error;
    },
  };
}

describe('createJobRadar', () => {
  it('returns healthy-source results when one source fails', async () => {
    const jobicyCalls = { value: 0 };
    const remoteCalls = { value: 0 };
    const radar = createJobRadar([
      ok('jobicy', [listing('jobicy', 'a')], jobicyCalls),
      fail('himalayas'),
      ok('remoteok', [listing('remoteok', 'b', 'Data Engineer')], remoteCalls),
    ], { now: () => NOW });

    const result = await radar.find();
    expect(result.jobs).toHaveLength(2);
    expect(result.sources.find((item) => item.source === 'himalayas')?.outcome).toBe('error');
    expect(result.sources.filter((item) => item.outcome === 'success')).toHaveLength(2);
  });

  it('uses a 60-minute warm cache per source', async () => {
    let now = NOW;
    const calls = { value: 0 };
    const radar = createJobRadar([
      ok('jobicy', [listing('jobicy', 'a')], calls),
    ], { now: () => now, ttlMs: 60 * 60 * 1000 });

    const first = await radar.find();
    now += 30 * 60 * 1000;
    const second = await radar.find();

    expect(calls.value).toBe(1);
    expect(first.sources[0]?.outcome).toBe('success');
    expect(second.sources[0]?.outcome).toBe('cache');
  });
  it('refetches after cache expiry and returns empty results when all sources fail', async () => {
    let now = NOW;
    const calls = { value: 0 };
    const radar = createJobRadar([
      ok('jobicy', [listing('jobicy', 'a')], calls),
    ], { now: () => now, ttlMs: 60 * 60 * 1000 });

    await radar.find();
    now += 61 * 60 * 1000;
    await radar.find();
    expect(calls.value).toBe(2);

    const failed = await createJobRadar([
      fail('jobicy'), fail('himalayas'), fail('remoteok'),
    ], { now: () => NOW }).find();
    expect(failed.jobs).toEqual([]);
    expect(failed.sources.map((item) => item.outcome)).toEqual(['error', 'error', 'error']);
  });

  it('records timeout without leaking an upstream error message', async () => {
    const timeout = new DOMException('private timeout details', 'TimeoutError');
    const result = await createJobRadar([
      fail('jobicy', timeout),
    ], { now: () => NOW }).find();

    expect(result.sources).toEqual([
      { source: 'jobicy', outcome: 'timeout', count: 0, latencyMs: 0 },
    ]);
    expect(JSON.stringify(result)).not.toContain('private timeout details');
  });
});

describe('default job radar factory', () => {
  it('uses exactly the three fixed public sources without env configuration', async () => {
    const seen: string[] = [];
    const fetchFn = async (input: string | URL) => {
      const url = String(input);
      seen.push(url);
      if (url.includes('jobicy.com')) return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
      if (url.includes('himalayas.app')) return new Response(JSON.stringify({ jobs: [] }), { status: 200 });
      return new Response(JSON.stringify([]), { status: 200 });
    };

    const result = await createJobRadarFromDefaults(fetchFn).find();

    expect(result.sources.map((source) => source.source)).toEqual(['jobicy', 'himalayas', 'remoteok']);
    expect(seen).toHaveLength(3);
    expect(seen.every((url) => url.startsWith('https://'))).toBe(true);
  });
});
