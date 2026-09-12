import type { ProjectAdapter, ProjectStatus } from './types.js';

export class CachedProjectAdapter implements ProjectAdapter {
  private cached: { expiresAt: number; status: ProjectStatus } | null = null;

  constructor(
    private readonly inner: ProjectAdapter,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isFinite(ttlMs) || ttlMs < 0) {
      throw new Error('Project cache TTL must be non-negative');
    }
  }

  async getStatus(): Promise<ProjectStatus> {
    const now = this.now();
    if (this.cached && now < this.cached.expiresAt) return this.cached.status;

    const status = await this.inner.getStatus();
    this.cached = { expiresAt: now + this.ttlMs, status };
    return status;
  }
}
