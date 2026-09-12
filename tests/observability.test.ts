import { describe, expect, it } from 'vitest';

import {
  createPostgresObservabilityStore,
  type ObservabilityStore,
  type ProviderOutcomeInput,
} from '../src/persistence/observability.js';
import {
  createPersistentProjectIntelligence,
  createPersistentProjectAdapter,
} from '../src/projects/persistent-intelligence.js';
import type { ProjectIntelligence } from '../src/projects/intelligence.js';
import type { ProjectAdapter, ProjectStatus } from '../src/projects/types.js';
import type { DatabaseExecutor } from '../src/persistence/types.js';

class FakeDatabase implements DatabaseExecutor {
  calls: Array<{ text: string; values: readonly unknown[] }> = [];
  async query<T = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
    this.calls.push({ text, values });
    return { rows: [] as T[], rowCount: 1 };
  }
}

class FakeStore implements ObservabilityStore {
  snapshots: ProjectStatus[] = [];
  digests: Array<{ date: string; deterministicDigest: string; aiEnhancedDigest: string | null }> = [];
  providers: ProviderOutcomeInput[] = [];
  failSnapshots = false;
  failDigests = false;

  async saveProjectSnapshot(status: ProjectStatus): Promise<void> {
    if (this.failSnapshots) throw new Error('snapshot db unavailable');
    this.snapshots.push(status);
  }
  async saveDailyDigest(input: { date: string; deterministicDigest: string; aiEnhancedDigest: string | null }): Promise<void> {
    if (this.failDigests) throw new Error('digest db unavailable');
    this.digests.push(input);
  }
  async recordProviderOutcome(input: ProviderOutcomeInput): Promise<void> {
    this.providers.push(input);
  }
}

const status: ProjectStatus = {
  key: 'github',
  title: 'GitHub',
  state: 'ok',
  summary: '3/3 repositories readable',
  details: ['repo-a: main - CI success'],
  capturedAt: '2026-09-12T10:00:00.000Z',
};

function adapter(): ProjectAdapter {
  return { async getStatus() { return status; } };
}

function intelligence(today = 'Today - Project Intelligence\nGitHub: ok'): ProjectIntelligence {
  return {
    github: async () => 'github',
    opendq: async () => 'opendq',
    dreamlogs: async () => 'dreamlogs',
    today: async () => today,
  };
}

describe('project observability persistence', () => {
  it('writes normalized project snapshots through parameterized SQL', async () => {
    const database = new FakeDatabase();
    const store = createPostgresObservabilityStore(database);

    await store.saveProjectSnapshot(status);

    expect(database.calls[0]?.text).toMatch(/insert into project_snapshots/i);
    expect(database.calls[0]?.values[0]).toBe('github');
    expect(database.calls[0]?.values[1]).toBe(JSON.stringify(status));
    expect(database.calls[0]?.values[2]).toBe(status.capturedAt);
  });

  it('upserts one deterministic digest per date', async () => {
    const database = new FakeDatabase();
    const store = createPostgresObservabilityStore(database);

    await store.saveDailyDigest({
      date: '2026-09-12',
      deterministicDigest: 'safe digest',
      aiEnhancedDigest: null,
    });

    expect(database.calls[0]?.text).toMatch(/insert into daily_digests/i);
    expect(database.calls[0]?.text).toMatch(/on conflict \(digest_date\)/i);
    expect(database.calls[0]?.values).toEqual(['2026-09-12', 'safe digest', null]);
  });

  it('records provider metadata without prompt or response text', async () => {
    const database = new FakeDatabase();
    const store = createPostgresObservabilityStore(database);

    await store.recordProviderOutcome({
      provider: 'openrouter',
      model: 'openrouter/free',
      outcome: 'error',
      latencyMs: 125,
      errorClass: 'TimeoutError',
      recordedAt: '2026-09-12T10:00:00.000Z',
    });

    expect(database.calls[0]?.text).toMatch(/insert into provider_outcomes/i);
    expect(database.calls[0]?.values).toEqual([
      'openrouter', 'openrouter/free', 'error', 125, 'TimeoutError', '2026-09-12T10:00:00.000Z',
    ]);
    expect(JSON.stringify(database.calls[0])).not.toMatch(/prompt|response body|secret context/i);
  });

  it('returns project status even when snapshot persistence fails', async () => {
    const store = new FakeStore();
    store.failSnapshots = true;
    const wrapped = createPersistentProjectAdapter(adapter(), store);

    await expect(wrapped.getStatus()).resolves.toEqual(status);
  });

  it('persists successful project snapshots best-effort', async () => {
    const store = new FakeStore();
    const wrapped = createPersistentProjectAdapter(adapter(), store);

    await wrapped.getStatus();

    expect(store.snapshots).toEqual([status]);
  });

  it('returns the deterministic daily digest even when persistence fails', async () => {
    const store = new FakeStore();
    store.failDigests = true;
    const base = intelligence('deterministic result');
    const wrapped = createPersistentProjectIntelligence(
      base,
      store,
      () => new Date('2026-09-12T23:59:59.000Z'),
    );

    await expect(wrapped.today()).resolves.toBe('deterministic result');
  });

  it('persists /today once using the UTC date', async () => {
    const store = new FakeStore();
    const wrapped = createPersistentProjectIntelligence(
      intelligence('deterministic result'),
      store,
      () => new Date('2026-09-13T00:01:00.000Z'),
    );

    await wrapped.today();

    expect(store.digests).toEqual([{
      date: '2026-09-13',
      deterministicDigest: 'deterministic result',
      aiEnhancedDigest: null,
    }]);
  });
});