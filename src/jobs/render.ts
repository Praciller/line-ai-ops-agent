import type { JobRadarResult, JobSource } from './types.js';

const MAX_OUTPUT = 4500;

const SOURCE_LABELS: Record<JobSource, string> = {
  jobicy: 'Jobicy',
  himalayas: 'Himalayas',
  remoteok: 'Remote OK',
};

function clean(value: string, max: number): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function age(postedAt: string | null, nowMs: number): string | null {
  if (!postedAt) return null;
  const posted = Date.parse(postedAt);
  if (!Number.isFinite(posted)) return null;
  const days = Math.max(0, Math.floor((nowMs - posted) / 86_400_000));
  return days === 0 ? 'today' : `${days}d ago`;
}

function unavailable(result: JobRadarResult): JobSource[] {
  return result.sources
    .filter((source) => source.outcome === 'error' || source.outcome === 'timeout')
    .map((source) => source.source);
}
export function renderJobRadar(result: JobRadarResult, nowMs = Date.now()): string {
  const checked = result.sources.map((source) => SOURCE_LABELS[source.source]);
  const down = unavailable(result).map((source) => SOURCE_LABELS[source]);

  if (result.jobs.length === 0) {
    const lines = [
      'No strong matches found right now',
      `Checked: ${checked.join(', ') || 'none'}`,
    ];
    if (down.length > 0) lines.push(`Unavailable: ${down.join(', ')}`);
    return lines.join('\n').slice(0, MAX_OUTPUT);
  }

  const entries = result.jobs.slice(0, 5).map((job, index) => {
    const listing = job.listing;
    const when = age(listing.postedAt, nowMs);
    const location = clean(listing.location || listing.remoteScope || 'Remote', 90);
    const context = when ? `${location} · ${when}` : location;
    const lines = [
      `${index + 1}. ${clean(listing.title, 90)} — ${clean(listing.company, 70)}`,
      `   ${context}`,
      `   Match: ${job.signals.slice(0, 3).map((signal) => clean(signal, 36)).join(', ') || 'role match'}`,
    ];
    if (listing.salary) lines.push(`   Salary: ${clean(listing.salary, 80)}`);
    lines.push(`   Source: ${SOURCE_LABELS[listing.source]}`);
    lines.push(`   Apply: ${clean(listing.url, 500)}`);
    return lines.join('\n');
  });

  const lines = ['/jobs — Top matches', '', entries.join('\n\n')];
  if (down.length > 0) lines.push('', `Unavailable: ${down.join(', ')}`);
  return lines.join('\n').slice(0, MAX_OUTPUT);
}
