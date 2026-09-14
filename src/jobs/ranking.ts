import {
  APAC_PATTERN,
  INCOMPATIBLE_ONLY_PATTERN,
  ROLE_RULES,
  SKILL_GROUPS,
  THAILAND_PATTERN,
  WORLDWIDE_PATTERN,
} from './profile.js';
import type { Eligibility, JobListing, RankedJob } from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const LOCATION_SCORE: Record<Eligibility, number> = {
  thailand: 20,
  worldwide: 18,
  apac: 14,
};
const ELIGIBILITY_ORDER: Record<Eligibility, number> = {
  thailand: 0,
  worldwide: 1,
  apac: 2,
};

function clean(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function roleMatch(title: string): { label: string; score: number } | null {
  const normalized = clean(title);
  for (const rule of ROLE_RULES) {
    if (rule.pattern.test(normalized)) return { label: rule.label, score: rule.score };
  }
  return null;
}

export function classifyEligibility(job: JobListing): Eligibility | null {
  const scope = clean(`${job.location} ${job.remoteScope ?? ''}`);
  if (THAILAND_PATTERN.test(scope)) return 'thailand';
  if (WORLDWIDE_PATTERN.test(scope)) return 'worldwide';
  if (APAC_PATTERN.test(scope)) return 'apac';
  if (INCOMPATIBLE_ONLY_PATTERN.test(scope)) return null;
  return null;
}

function freshnessScore(postedAt: string | null, nowMs: number): number {
  if (!postedAt) return 2;
  const postedMs = Date.parse(postedAt);
  if (!Number.isFinite(postedMs)) return 2;
  const days = Math.floor(Math.max(0, nowMs - postedMs) / DAY_MS);
  if (days <= 3) return 10;
  if (days <= 7) return 8;
  if (days <= 14) return 6;
  if (days <= 30) return 3;
  return 1;
}

function matchedSkills(job: JobListing): string[] {
  const haystack = clean([job.title, ...job.tags].join(' '));
  return SKILL_GROUPS
    .filter((group) => group.pattern.test(haystack))
    .slice(0, 5)
    .map((group) => group.label);
}

export function scoreJob(job: JobListing, nowMs: number): RankedJob | null {
  const role = roleMatch(job.title);
  const eligibility = classifyEligibility(job);
  if (!role || role.score < 24 || !eligibility) return null;

  const skills = matchedSkills(job);
  const score = role.score
    + skills.length * 5
    + LOCATION_SCORE[eligibility]
    + freshnessScore(job.postedAt, nowMs)
    + (job.salary?.trim() ? 5 : 0);

  if (score < 45) return null;
  return {
    listing: job,
    eligibility,
    score,
    signals: [role.label, ...skills, eligibility],
  };
}

function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return clean(raw).toLowerCase();
  }
}

function identityKey(job: JobListing): string {
  return [job.company, job.title, job.location]
    .map((value) => clean(value).toLowerCase())
    .join('|');
}

function postedMs(job: JobListing): number {
  if (!job.postedAt) return Number.NEGATIVE_INFINITY;
  const value = Date.parse(job.postedAt);
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function duplicatePreference(job: JobListing): [number, number, number, string] {
  const eligibility = classifyEligibility(job);
  const clarity = eligibility === 'thailand' ? 3 : eligibility === 'worldwide' ? 2 : eligibility === 'apac' ? 1 : 0;
  return [clarity, postedMs(job), job.salary?.trim() ? 1 : 0, job.source];
}

function prefer(a: JobListing, b: JobListing): JobListing {
  const left = duplicatePreference(a);
  const right = duplicatePreference(b);
  if (left[0] !== right[0]) return left[0] > right[0] ? a : b;
  if (left[1] !== right[1]) return left[1] > right[1] ? a : b;
  if (left[2] !== right[2]) return left[2] > right[2] ? a : b;
  return left[3].localeCompare(right[3]) <= 0 ? a : b;
}

function dedupeBy(jobs: readonly JobListing[], keyOf: (job: JobListing) => string): JobListing[] {
  const selected = new Map<string, JobListing>();
  for (const job of jobs) {
    const key = keyOf(job);
    const current = selected.get(key);
    selected.set(key, current ? prefer(current, job) : job);
  }
  return [...selected.values()];
}

function compareRanked(a: RankedJob, b: RankedJob): number {
  const eligibility = ELIGIBILITY_ORDER[a.eligibility] - ELIGIBILITY_ORDER[b.eligibility];
  if (eligibility !== 0) return eligibility;
  if (a.score !== b.score) return b.score - a.score;
  const leftDate = postedMs(a.listing);
  const rightDate = postedMs(b.listing);
  if (leftDate !== rightDate) return rightDate > leftDate ? 1 : -1;
  const source = a.listing.source.localeCompare(b.listing.source);
  if (source !== 0) return source;
  const company = clean(a.listing.company).localeCompare(clean(b.listing.company));
  if (company !== 0) return company;
  const title = clean(a.listing.title).localeCompare(clean(b.listing.title));
  if (title !== 0) return title;
  return a.listing.sourceId.localeCompare(b.listing.sourceId);
}

export function dedupeAndRank(jobs: readonly JobListing[], nowMs: number): RankedJob[] {
  const byUrl = dedupeBy(jobs, (job) => canonicalUrl(job.url));
  const byIdentity = dedupeBy(byUrl, identityKey);
  return byIdentity
    .map((job) => scoreJob(job, nowMs))
    .filter((job): job is RankedJob => job !== null)
    .sort(compareRanked);
}
