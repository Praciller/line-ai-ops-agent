export type JobSource = 'jobicy' | 'himalayas' | 'remoteok';

export type Eligibility = 'thailand' | 'worldwide' | 'apac';

export type JobListing = {
  source: JobSource;
  sourceId: string;
  title: string;
  company: string;
  location: string;
  remoteScope: string | null;
  employmentType: string | null;
  salary: string | null;
  postedAt: string | null;
  tags: readonly string[];
  url: string;
};

export type RankedJob = {
  listing: JobListing;
  eligibility: Eligibility;
  score: number;
  signals: readonly string[];
};

export type JobSourceBatch = {
  source: JobSource;
  jobs: readonly JobListing[];
  fetchedAt: string;
};

export type JobSourceStatus = {
  source: JobSource;
  outcome: 'success' | 'timeout' | 'error' | 'cache';
  count: number;
  latencyMs: number;
};

export type JobRadarResult = {
  jobs: readonly RankedJob[];
  sources: readonly JobSourceStatus[];
  generatedAt: string;
};
