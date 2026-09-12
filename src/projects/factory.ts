import type { ProjectConfig } from '../config.js';
import type { ObservabilityStore } from '../persistence/observability.js';
import { CachedProjectAdapter } from './cache.js';
import { createDreamLogsProjectAdapter } from './dreamlogs.js';
import {
  createGitHubProjectAdapter,
  createGitHubRepositoryReader,
} from './github.js';
import { createProjectHttpClient } from './http.js';
import {
  createProjectIntelligence,
  type ProjectIntelligence,
} from './intelligence.js';
import { createOpenDQProjectAdapter } from './opendq.js';
import {
  createPersistentProjectAdapter,
  createPersistentProjectIntelligence,
} from './persistent-intelligence.js';
import type { ProjectAdapter } from './types.js';

type ProjectIntelligenceFactoryOptions = {
  observability?: ObservabilityStore;
};

export function createProjectIntelligenceFromConfig(
  config: ProjectConfig,
  options: ProjectIntelligenceFactoryOptions = {},
): ProjectIntelligence {
  const http = createProjectHttpClient({ timeoutMs: config.requestTimeoutMs });
  const githubReader = createGitHubRepositoryReader({
    owner: config.githubOwner,
    http,
  });
  const cache = (adapter: ProjectAdapter): ProjectAdapter =>
    new CachedProjectAdapter(adapter, config.cacheTtlMs);
  const persist = (adapter: ProjectAdapter): ProjectAdapter =>
    options.observability
      ? createPersistentProjectAdapter(adapter, options.observability)
      : adapter;

  const base = createProjectIntelligence({
    github: persist(cache(createGitHubProjectAdapter({
      owner: config.githubOwner,
      repos: config.githubRepos,
      http,
    }))),
    opendq: persist(cache(createOpenDQProjectAdapter({
      config,
      github: githubReader,
      http,
    }))),
    dreamlogs: persist(cache(createDreamLogsProjectAdapter({
      config,
      github: githubReader,
      http,
    }))),
  });

  return options.observability
    ? createPersistentProjectIntelligence(base, options.observability)
    : base;
}