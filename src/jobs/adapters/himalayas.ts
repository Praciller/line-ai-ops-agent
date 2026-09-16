import { z } from 'zod';

import type { JobListing, JobSourceBatch } from '../types.js';
import { fetchJson } from './http.js';
import type { FetchLike, JobSourceAdapter } from './types.js';

const LocationRestriction = z.union([
  z.string(),
  z.object({ name: z.string() }),
]);

const HimalayasJob = z.object({
  title: z.string().min(1),
  companyName: z.string().min(1),
  employmentType: z.string().nullable().optional(),
  locationRestrictions: z.array(LocationRestriction).optional().default([]),
  minSalary: z.number().nullable().optional(),
  maxSalary: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  salaryPeriod: z.string().nullable().optional(),
  categories: z.array(z.string()).optional().default([]),
  pubDate: z.union([z.string(), z.number()]).nullable().optional(),
  applicationLink: z.string().url(),
  guid: z.union([z.string(), z.number()]),
});

const Payload = z.object({ jobs: z.array(z.unknown()).default([]) });
const ENDPOINT = new URL('https://himalayas.app/jobs/api/search?q=engineer&sort=recent&page=1');
function salary(job: z.infer<typeof HimalayasJob>): string | null {
  const values = [job.minSalary, job.maxSalary].filter((value): value is number => typeof value === 'number');
  if (values.length === 0) return null;
  const range = values.length === 2 ? `${values[0]}-${values[1]}` : `${values[0]}`;
  return [job.currency, range, job.salaryPeriod].filter(Boolean).join(' ');
}

function postedAt(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
  }
  const millis = value < 1_000_000_000_000 ? value * 1000 : value;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeLocation(values: z.infer<typeof LocationRestriction>[]): string {
  const names = values
    .map((value) => typeof value === 'string' ? value : value.name)
    .map((value) => value.trim())
    .filter(Boolean);
  return names.length > 0 ? names.join(', ') : 'Worldwide';
}

function normalize(value: unknown): JobListing | null {
  const parsed = HimalayasJob.safeParse(value);
  if (!parsed.success) return null;
  const job = parsed.data;
  let url: URL;
  try {
    url = new URL(job.applicationLink);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  const location = normalizeLocation(job.locationRestrictions);
  return {
    source: 'himalayas',
    sourceId: String(job.guid),
    title: job.title,
    company: job.companyName,
    location,
    remoteScope: location,
    employmentType: job.employmentType ?? null,
    salary: salary(job),
    postedAt: postedAt(job.pubDate),
    tags: job.categories,
    url: url.toString(),
  };
}

export function createHimalayasAdapter(fetchFn: FetchLike = fetch): JobSourceAdapter {
  return {
    source: 'himalayas',
    async fetch(signal?: AbortSignal): Promise<JobSourceBatch> {
      const raw = await fetchJson(ENDPOINT, 'himalayas.app', fetchFn, signal);
      const payload = Payload.safeParse(raw);
      const jobs = payload.success
        ? payload.data.jobs.slice(0, 20).flatMap((item) => {
          const job = normalize(item);
          return job ? [job] : [];
        })
        : [];
      return { source: 'himalayas', jobs, fetchedAt: new Date().toISOString() };
    },
  };
}
