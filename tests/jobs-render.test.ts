import { describe, expect, it } from 'vitest';

import { renderJobRadar } from '../src/jobs/render.js';
import type { JobRadarResult, RankedJob } from '../src/jobs/types.js';

const NOW_MS = Date.parse('2026-09-15T00:00:00Z');
const NOW = new Date(NOW_MS).toISOString();

function ranked(id: number, overrides: Partial<RankedJob['listing']> = {}): RankedJob {
  return {
    eligibility: 'worldwide',
    score: 80,
    signals: ['AI Engineer', 'Python', 'Worldwide'],
    listing: {
      source: 'himalayas',
      sourceId: String(id),
      title: `AI Engineer ${id}`,
      company: `Company ${id}`,
      location: 'Worldwide',
      remoteScope: 'Worldwide',
      employmentType: 'Full-time',
      salary: 'USD 90000-120000 year',
      postedAt: '2026-09-14T00:00:00Z',
      tags: ['Python'],
      url: `https://example.com/jobs/${id}`,
      ...overrides,
    },
  };
}

function result(jobs: RankedJob[]): JobRadarResult {
  return {
    jobs,
    sources: [
      { source: 'jobicy', outcome: 'success', count: 3, latencyMs: 20 },
      { source: 'himalayas', outcome: 'success', count: 3, latencyMs: 25 },
      { source: 'remoteok', outcome: 'error', count: 0, latencyMs: 30 },
    ],
    generatedAt: NOW,
  };
}
describe('renderJobRadar', () => {
  it('renders at most five concise attributed jobs', () => {
    const text = renderJobRadar(result([
      ranked(1), ranked(2), ranked(3), ranked(4), ranked(5), ranked(6),
    ]), NOW_MS);

    expect(text.match(/^\d+\./gm)).toHaveLength(5);
    expect(text).toContain('Source: Himalayas');
    expect(text).toContain('Apply: https://example.com/jobs/1');
    expect(text).toContain('Salary: USD 90000-120000 year');
    expect(text).toContain('1d ago');
    expect(text.length).toBeLessThanOrEqual(4500);
  });

  it('strips control characters and bounds untrusted text', () => {
    const long = `Bad\u0000Title ${'x'.repeat(7000)}`;
    const text = renderJobRadar(result([ranked(1, {
      title: long,
      company: `Co\n${'y'.repeat(7000)}`,
      location: `Remote\t${'z'.repeat(7000)}`,
    })]), NOW_MS);

    expect(text).not.toContain('\u0000');
    expect(text.length).toBeLessThanOrEqual(4500);
    expect(text).not.toContain('x'.repeat(100));
  });

  it('returns truthful no-match text and names degraded sources', () => {
    const text = renderJobRadar(result([]), NOW_MS);
    expect(text).toContain('No strong matches found right now');
    expect(text).toContain('Checked: Jobicy, Himalayas, Remote OK');
    expect(text).toContain('Unavailable: Remote OK');
  });
});
