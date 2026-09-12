import type { ObservabilityStore } from '../persistence/observability.js';
import type { ProjectIntelligence } from './intelligence.js';
import type { ProjectAdapter } from './types.js';

async function bestEffort(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch {
    // Persistence must never replace deterministic project output.
  }
}

export function createPersistentProjectAdapter(
  adapter: ProjectAdapter,
  store: ObservabilityStore,
): ProjectAdapter {
  return {
    async getStatus() {
      const status = await adapter.getStatus();
      await bestEffort(() => store.saveProjectSnapshot(status));
      return status;
    },
  };
}

export function createPersistentProjectIntelligence(
  base: ProjectIntelligence,
  store: ObservabilityStore,
  now: () => Date = () => new Date(),
): ProjectIntelligence {
  return {
    github: () => base.github(),
    opendq: () => base.opendq(),
    dreamlogs: () => base.dreamlogs(),
    async today(): Promise<string> {
      const digest = await base.today();
      const date = now().toISOString().slice(0, 10);
      await bestEffort(() => store.saveDailyDigest({
        date,
        deterministicDigest: digest,
        aiEnhancedDigest: null,
      }));
      return digest;
    },
  };
}