import { describe, expect, it } from 'vitest';

import { createRemoteOkAdapter } from '../src/jobs/adapters/remoteok.js';
import type { FetchLike } from '../src/jobs/adapters/types.js';

function fakeFetch(value: unknown): FetchLike {
  return async () => new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Remote OK adapter', () => {
  it('ignores metadata and normalizes approved fields only', async () => {
    const payload = [
      { legal: 'metadata row' },
      {
        id: 88,
        position: 'Data Engineer',
        company: 'Remote Co',
        location: 'Worldwide',
        tags: ['python', 'sql'],
        date: '2026-09-14T00:00:00Z',
        epoch: 1789344000,
        salary_min: 70000,
        salary_max: 110000,
        url: 'https://remoteok.com/remote-jobs/88-data-engineer',
        description: '<b>do-not-keep</b>',
      },
    ];

    const batch = await createRemoteOkAdapter(fakeFetch(payload)).fetch();
    expect(batch.source).toBe('remoteok');
    expect(batch.jobs).toHaveLength(1);
    expect(batch.jobs[0]).toMatchObject({
      source: 'remoteok', sourceId: '88', title: 'Data Engineer', company: 'Remote Co',
      location: 'Worldwide', remoteScope: 'Worldwide', tags: ['python', 'sql'],
      salary: '70000-110000', url: 'https://remoteok.com/remote-jobs/88-data-engineer',
    });
    expect(JSON.stringify(batch)).not.toContain('do-not-keep');
  });
  it('skips malformed and non-Remote OK job URLs', async () => {
    const payload = [
      { legal: 'metadata row' },
      {
        id: 1, position: 'AI Engineer', company: 'Bad Host', location: 'Worldwide',
        tags: [], url: 'https://evil.example/job/1',
      },
      {
        id: 2, position: 'AI Engineer', company: 'Good Host', location: 'APAC',
        tags: [], url: 'https://remoteok.com/remote-jobs/2-ai-engineer',
      },
      { id: 3, position: '', company: 'Broken', url: 'https://remoteok.com/remote-jobs/3' },
    ];

    const batch = await createRemoteOkAdapter(fakeFetch(payload)).fetch();
    expect(batch.jobs.map((job) => job.sourceId)).toEqual(['2']);
  });
});

it('treats zero salary bounds as missing metadata', async () => {
  const payload = [
    { legal: 'metadata row' },
    {
      id: 99,
      position: 'AI Engineer',
      company: 'No Salary Co',
      location: 'Worldwide',
      tags: ['python'],
      salary_min: 0,
      salary_max: 0,
      url: 'https://remoteok.com/remote-jobs/99-ai-engineer',
    },
  ];

  const batch = await createRemoteOkAdapter(fakeFetch(payload)).fetch();
  expect(batch.jobs[0]?.salary).toBeNull();
});
