import { describe, expect, it } from 'vitest';

import { createHimalayasAdapter } from '../src/jobs/adapters/himalayas.js';
import type { FetchLike } from '../src/jobs/adapters/types.js';

function fakeFetch(value: unknown): FetchLike {
  return async () => new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Himalayas adapter', () => {
  it('normalizes structured fields and worldwide scope', async () => {
    const payload = { jobs: [{
      title: 'Machine Learning Engineer',
      companyName: 'Example AI',
      employmentType: 'Full-time',
      locationRestrictions: [],
      minSalary: 90000,
      maxSalary: 130000,
      currency: 'USD',
      salaryPeriod: 'year',
      categories: ['Machine Learning', 'Python'],
      pubDate: '2026-09-14T00:00:00Z',
      applicationLink: 'https://example.com/apply/ml-engineer',
      guid: 'h-1',
      description: '<script>do-not-keep()</script>',
    }] };

    const batch = await createHimalayasAdapter(fakeFetch(payload)).fetch();
    expect(batch.source).toBe('himalayas');
    expect(batch.jobs[0]).toMatchObject({
      source: 'himalayas', sourceId: 'h-1', title: 'Machine Learning Engineer',
      company: 'Example AI', location: 'Worldwide', remoteScope: 'Worldwide',
      employmentType: 'Full-time', salary: 'USD 90000-130000 year',
      tags: ['Machine Learning', 'Python'], url: 'https://example.com/apply/ml-engineer',
    });
    expect(JSON.stringify(batch)).not.toContain('do-not-keep');
  });
  it('maps explicit location restrictions and skips malformed application URLs', async () => {
    const payload = { jobs: [
      {
        title: 'Data Engineer', companyName: 'APAC Co', employmentType: 'Full-time',
        locationRestrictions: [{ name: 'Thailand' }, { name: 'Singapore' }],
        categories: ['Data'], pubDate: 1789344000,
        applicationLink: 'https://example.com/jobs/data', guid: 2,
      },
      {
        title: 'AI Engineer', companyName: 'Broken', locationRestrictions: [],
        categories: [], applicationLink: 'not-a-url', guid: 3,
      },
    ] };

    const batch = await createHimalayasAdapter(fakeFetch(payload)).fetch();
    expect(batch.jobs).toHaveLength(1);
    expect(batch.jobs[0]?.location).toBe('Thailand, Singapore');
    expect(batch.jobs[0]?.remoteScope).toBe('Thailand, Singapore');
    expect(batch.jobs[0]?.postedAt).toBeTruthy();
  });
});
