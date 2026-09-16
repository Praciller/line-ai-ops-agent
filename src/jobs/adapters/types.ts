import type { JobSource, JobSourceBatch } from '../types.js';

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface JobSourceAdapter {
  readonly source: JobSource;
  fetch(signal?: AbortSignal): Promise<JobSourceBatch>;
}
