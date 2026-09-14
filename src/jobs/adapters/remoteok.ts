import { z } from 'zod';

import type { JobListing, JobSourceBatch } from '../types.js';
import { fetchJson } from './http.js';
import type { FetchLike, JobSourceAdapter } from './types.js';

const RemoteOkJob = z.object({
  id: z.union([z.string(), z.number()]),
  position: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional().default('Worldwide'),
  tags: z.array(z.string()).optional().default([]),
  date: z.string().nullable().optional(),
  epoch: z.number().nullable().optional(),
  salary_min: z.number().nullable().optional(),
  salary_max: z.number().nullable().optional(),
  url: z.string().url(),
});

const ENDPOINT = new URL('https://remoteok.com/api');

function salary(job: z.infer<typeof RemoteOkJob>): string | null {
  const values = [job.salary_min, job.salary_max].filter((value): value is number => typeof value === 'number');
  if (values.length === 0) return null;
  return values.length === 2 ? `${values[0]}-${values[1]}` : `${values[0]}`;
}

function postedAt(job: z.infer<typeof RemoteOkJob>): string | null {
  if (job.date) {
    const time = Date.parse(job.date);
    if (Number.isFinite(time)) return new Date(time).toISOString();
  }
  if (typeof job.epoch === 'number') {
    const millis = job.epoch < 1_000_000_000_000 ? job.epoch * 1000 : job.epoch;
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function normalize(value: unknown): JobListing | null {
  const parsed = RemoteOkJob.safeParse(value);
  if (!parsed.success) return null;
  const job = parsed.data;

  let url: URL;
  try {
    url = new URL(job.url);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !['remoteok.com', 'www.remoteok.com'].includes(url.hostname)) {
    return null;
  }

  const location = job.location.trim() || 'Worldwide';
  return {
    source: 'remoteok',
    sourceId: String(job.id),
    title: job.position,
    company: job.company,
    location,
    remoteScope: location,
    employmentType: null,
    salary: salary(job),
    postedAt: postedAt(job),
    tags: job.tags,
    url: url.toString(),
  };
}

export function createRemoteOkAdapter(fetchFn: FetchLike = fetch): JobSourceAdapter {
  return {
    source: 'remoteok',
    async fetch(signal?: AbortSignal): Promise<JobSourceBatch> {
      const raw = await fetchJson(ENDPOINT, 'remoteok.com', fetchFn, signal);
      const rows = Array.isArray(raw) ? raw.slice(1) : [];
      const jobs = rows.flatMap((item) => {
        const job = normalize(item);
        return job ? [job] : [];
      });
      return { source: 'remoteok', jobs, fetchedAt: new Date().toISOString() };
    },
  };
}
