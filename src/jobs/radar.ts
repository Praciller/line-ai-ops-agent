import type { JobSourceAdapter } from './adapters/types.js';
import { dedupeAndRank } from './ranking.js';
import type {
  JobRadarResult,
  JobSource,
  JobSourceBatch,
  JobSourceStatus,
} from './types.js';

export interface JobRadar {
  find(): Promise<JobRadarResult>;
}

type RadarOptions = {
  now?: () => number;
  ttlMs?: number;
  timeoutMs?: number;
};

type CacheEntry = {
  expiresAt: number;
  batch: JobSourceBatch;
};

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError';
}

export function createJobRadar(
  adapters: readonly JobSourceAdapter[],
  options: RadarOptions = {},
): JobRadar {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? 60 * 60 * 1000;
  const timeoutMs = options.timeoutMs ?? 5000;
  const cache = new Map<JobSource, CacheEntry>();
  return {
    async find(): Promise<JobRadarResult> {
      const runs = await Promise.all(adapters.map(async (adapter) => {
        const startedAt = now();
        const cached = cache.get(adapter.source);
        if (cached && cached.expiresAt > startedAt) {
          const status: JobSourceStatus = {
            source: adapter.source,
            outcome: 'cache',
            count: cached.batch.jobs.length,
            latencyMs: 0,
          };
          return { batch: cached.batch, status };
        }

        try {
          const batch = await adapter.fetch(AbortSignal.timeout(timeoutMs));
          cache.set(adapter.source, { expiresAt: startedAt + ttlMs, batch });
          const status: JobSourceStatus = {
            source: adapter.source,
            outcome: 'success',
            count: batch.jobs.length,
            latencyMs: Math.max(0, now() - startedAt),
          };
          return { batch, status };
        } catch (error) {
          const status: JobSourceStatus = {
            source: adapter.source,
            outcome: isTimeout(error) ? 'timeout' : 'error',
            count: 0,
            latencyMs: Math.max(0, now() - startedAt),
          };
          const batch: JobSourceBatch = {
            source: adapter.source,
            jobs: [],
            fetchedAt: new Date(startedAt).toISOString(),
          };
          return { batch, status };
        }
      }));
      const generatedAt = now();
      return {
        jobs: dedupeAndRank(
          runs.flatMap((run) => run.batch.jobs),
          generatedAt,
        ).slice(0, 5),
        sources: runs.map((run) => run.status),
        generatedAt: new Date(generatedAt).toISOString(),
      };
    },
  };
}
