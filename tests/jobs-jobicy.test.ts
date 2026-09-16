import { describe, expect, it } from 'vitest';

import { fetchJson } from '../src/jobs/adapters/http.js';
import { createJobicyAdapter } from '../src/jobs/adapters/jobicy.js';
import type { FetchLike } from '../src/jobs/adapters/types.js';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fakeFetch(value: unknown): FetchLike {
  return async () => jsonResponse(value);
}

describe('Jobicy adapter', () => {
  it('normalizes approved fields and ignores descriptions', async () => {
    const payload = { jobs: [{
      id: 123,
      url: 'https://jobicy.com/jobs/ai-engineer',
      jobTitle: 'AI Engineer',
      companyName: 'Example',
      jobIndustry: ['Data Science'],
      jobType: ['full-time'],
      jobGeo: 'Anywhere',
      pubDate: '2026-09-14T00:00:00Z',
      salaryMin: 80000,
      salaryMax: 120000,
      salaryCurrency: 'USD',
      salaryPeriod: 'yearly',
      jobDescription: '<script>secret()</script>',
    }] };
    const batch = await createJobicyAdapter(fakeFetch(payload)).fetch();

    expect(batch.source).toBe('jobicy');
    expect(batch.jobs).toHaveLength(1);
    expect(batch.jobs[0]).toMatchObject({
      source: 'jobicy',
      sourceId: '123',
      title: 'AI Engineer',
      company: 'Example',
      location: 'Anywhere',
      remoteScope: 'Anywhere',
      employmentType: 'full-time',
      salary: 'USD 80000-120000 yearly',
      postedAt: '2026-09-14T00:00:00Z',
      tags: ['Data Science'],
      url: 'https://jobicy.com/jobs/ai-engineer',
    });
    expect(JSON.stringify(batch)).not.toContain('secret()');
  });

  it('skips malformed records instead of throwing', async () => {
    const payload = { jobs: [
      { id: 1, jobTitle: 'AI Engineer' },
      {
        id: 2, url: 'https://jobicy.com/jobs/data-engineer',
        jobTitle: 'Data Engineer', companyName: 'Good', jobGeo: 'Anywhere',
      },
    ] };
    const batch = await createJobicyAdapter(fakeFetch(payload)).fetch();
    expect(batch.jobs.map((job) => job.sourceId)).toEqual(['2']);
  });
});

describe('fixed-host job HTTP', () => {
  it('rejects a host mismatch before fetch is called', async () => {
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls += 1;
      return jsonResponse({});
    };

    await expect(fetchJson(
      new URL('https://evil.example/jobs'),
      'jobicy.com',
      fetchImpl,
    )).rejects.toThrow('JobSourceHostError');
    expect(calls).toBe(0);
  });

  it('returns stable sanitized error classes without response bodies', async () => {
    const rateLimited: FetchLike = async () => new Response('private upstream body', { status: 429 });
    const broken: FetchLike = async () => new Response('another private body', { status: 500 });

    await expect(fetchJson(new URL('https://jobicy.com/api/v2/remote-jobs'), 'jobicy.com', rateLimited))
      .rejects.toThrow(/^JobSourceRateLimitError$/);
    await expect(fetchJson(new URL('https://jobicy.com/api/v2/remote-jobs'), 'jobicy.com', broken))
      .rejects.toThrow(/^JobSourceHttpError$/);
  });
});
