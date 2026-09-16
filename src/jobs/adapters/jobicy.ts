import { z } from 'zod';

import type { JobListing, JobSourceBatch } from '../types.js';
import { fetchJson } from './http.js';
import type { FetchLike, JobSourceAdapter } from './types.js';

const JobicyJob = z.object({
  id: z.union([z.string(), z.number()]),
  url: z.string().url(),
  jobTitle: z.string().min(1),
  companyName: z.string().min(1),
  jobIndustry: z.array(z.string()).optional().default([]),
  jobType: z.array(z.string()).optional().default([]),
  jobGeo: z.string().optional().default('Anywhere'),
  pubDate: z.string().nullable().optional(),
  salaryMin: z.number().nullable().optional(),
  salaryMax: z.number().nullable().optional(),
  salaryCurrency: z.string().nullable().optional(),
  salaryPeriod: z.string().nullable().optional(),
});

const JobicyPayload = z.object({ jobs: z.array(z.unknown()).default([]) });
const ENDPOINT = new URL('https://jobicy.com/api/v2/remote-jobs?count=100');

function formatSalary(job: z.infer<typeof JobicyJob>): string | null {
  const values = [job.salaryMin, job.salaryMax].filter((value): value is number => typeof value === 'number');
  if (values.length === 0) return null;
  const range = values.length === 2 ? `${values[0]}-${values[1]}` : `${values[0]}`;
  return [job.salaryCurrency, range, job.salaryPeriod].filter(Boolean).join(' ');
}
function normalizeJob(value: unknown): JobListing | null {
  const parsed = JobicyJob.safeParse(value);
  if (!parsed.success) return null;
  const job = parsed.data;

  let url: URL;
  try {
    url = new URL(job.url);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !['jobicy.com', 'www.jobicy.com'].includes(url.hostname)) {
    return null;
  }

  return {
    source: 'jobicy',
    sourceId: String(job.id),
    title: job.jobTitle,
    company: job.companyName,
    location: job.jobGeo,
    remoteScope: job.jobGeo,
    employmentType: job.jobType[0] ?? null,
    salary: formatSalary(job),
    postedAt: job.pubDate ?? null,
    tags: job.jobIndustry,
    url: url.toString(),
  };
}

export function createJobicyAdapter(fetchFn: FetchLike = fetch): JobSourceAdapter {
  return {
    source: 'jobicy',
    async fetch(signal?: AbortSignal): Promise<JobSourceBatch> {
      const raw = await fetchJson(ENDPOINT, 'jobicy.com', fetchFn, signal);
      const payload = JobicyPayload.safeParse(raw);
      const jobs = payload.success
        ? payload.data.jobs.flatMap((item) => {
          const normalized = normalizeJob(item);
          return normalized ? [normalized] : [];
        })
        : [];

      return { source: 'jobicy', jobs, fetchedAt: new Date().toISOString() };
    },
  };
}
