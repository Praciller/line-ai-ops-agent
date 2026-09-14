import { describe, expect, it } from 'vitest';

import { dedupeAndRank } from '../src/jobs/ranking.js';
import type { JobListing, JobSource } from '../src/jobs/types.js';

const NOW = Date.parse('2026-09-15T00:00:00Z');

function job(overrides: Partial<JobListing> = {}): JobListing {
  return {
    source: 'jobicy' as JobSource,
    sourceId: 'job-1',
    title: 'AI Engineer',
    company: 'Example Co',
    location: 'Bangkok, Thailand',
    remoteScope: null,
    employmentType: 'full-time',
    salary: null,
    postedAt: '2026-09-14T00:00:00Z',
    tags: ['Python', 'LLM'],
    url: 'https://example.com/jobs/1',
    ...overrides,
  };
}

describe('dedupeAndRank', () => {
  it('prefers Thailand-local roles and rejects incompatible location scope', () => {
    const ranked = dedupeAndRank([
      job({ sourceId: 'th', url: 'https://example.com/jobs/th' }),
      job({
        sourceId: 'us',
        location: 'United States only',
        remoteScope: 'US only',
        url: 'https://example.com/jobs/us',
      }),
      job({
        sourceId: 'worldwide',
        title: 'Data Engineer',
        location: 'Worldwide',
        remoteScope: 'Worldwide',
        url: 'https://example.com/jobs/worldwide',
      }),
    ], NOW);

    expect(ranked.map((item) => item.listing.sourceId)).toEqual(['th', 'worldwide']);
    expect(ranked[0]?.eligibility).toBe('thailand');
    expect(ranked[1]?.eligibility).toBe('worldwide');
  });
});

  it('applies the fixed 100-point score table', () => {
    const [ranked] = dedupeAndRank([job({
      salary: 'THB 80,000-120,000',
      tags: ['Python', 'SQL', 'LLM', 'Kafka', 'Docker'],
    })], NOW);

    expect(ranked?.score).toBe(100);
    expect(ranked?.signals).toEqual(expect.arrayContaining(['Python', 'SQL', 'LLM/Agents']));
  });

  it('keeps viable Thailand roles ahead of higher-scoring worldwide fallback roles', () => {
    const ranked = dedupeAndRank([
      job({
        sourceId: 'worldwide-ai',
        location: 'Worldwide', remoteScope: 'Worldwide',
        salary: 'USD 100k', tags: ['Python', 'SQL', 'LLM', 'Kafka', 'Docker'],
        url: 'https://example.com/jobs/worldwide-ai',
      }),
      job({
        sourceId: 'thai-data', title: 'Data Engineer',
        tags: [], url: 'https://example.com/jobs/thai-data',
      }),
    ], NOW);

    expect(ranked[0]?.listing.sourceId).toBe('thai-data');
    expect(ranked[1]?.listing.sourceId).toBe('worldwide-ai');
    expect(ranked[1]?.score).toBeGreaterThan(ranked[0]?.score ?? 0);
  });

  it('deduplicates canonical URLs and normalized identity deterministically', () => {
    const ranked = dedupeAndRank([
      job({
        source: 'remoteok', sourceId: 'url-world', location: 'Worldwide', remoteScope: 'Worldwide',
        postedAt: '2026-09-15T00:00:00Z', salary: 'USD 100k',
        url: 'https://example.com/jobs/shared/?utm_source=x',
      }),
      job({
        source: 'jobicy', sourceId: 'url-th', postedAt: '2026-09-10T00:00:00Z',
        url: 'https://example.com/jobs/shared',
      }),
      job({
        source: 'remoteok', sourceId: 'identity-old', company: 'Example\u0000 Co',
        title: 'Data Engineer', location: 'Worldwide', remoteScope: 'Worldwide',
        postedAt: '2026-09-10T00:00:00Z', url: 'https://remoteok.com/old',
      }),
      job({
        source: 'himalayas', sourceId: 'identity-new', company: 'Example Co',
        title: 'Data Engineer', location: 'Worldwide', remoteScope: 'Worldwide',
        postedAt: '2026-09-14T00:00:00Z', url: 'https://himalayas.app/new',
      }),
    ], NOW);

    expect(ranked.map((item) => item.listing.sourceId)).toEqual(['url-th', 'identity-new']);
  });

  it('uses unknown-date credit, accepts APAC, and resolves exact ties stably', () => {
    const ranked = dedupeAndRank([
      job({
        source: 'remoteok', sourceId: 'remote-b', company: 'Remote B Co', location: 'APAC', remoteScope: 'APAC',
        postedAt: null, tags: [], url: 'https://remoteok.com/b',
      }),
      job({
        source: 'himalayas', sourceId: 'remote-a', company: 'Remote A Co', location: 'APAC', remoteScope: 'Asia-Pacific',
        postedAt: null, tags: [], url: 'https://himalayas.app/a',
      }),
    ], NOW);

    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.score).toBe(56);
    expect(ranked.map((item) => item.listing.source)).toEqual(['himalayas', 'remoteok']);
  });

  it('rejects unrelated roles even when every other signal is strong', () => {
    const ranked = dedupeAndRank([job({
      title: 'Frontend Engineer', salary: 'USD 200k',
      tags: ['Python', 'SQL', 'LLM', 'Kafka', 'Docker'],
    })], NOW);
    expect(ranked).toEqual([]);
  });
