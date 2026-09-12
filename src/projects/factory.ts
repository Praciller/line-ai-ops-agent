import type { ProjectConfig } from '../config.js';
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
import type { ProjectAdapter } from './types.js';

export function createProjectIntelligenceFromConfig(
  config: ProjectConfig,
): ProjectIntelligence {
  const http = createProjectHttpClient({ timeoutMs: config.requestTimeoutMs });
  const githubReader = createGitHubRepositoryReader({
    owner: config.githubOwner,
    http,
  });
  const cache = (adapter: ProjectAdapter): ProjectAdapter =>
    new CachedProjectAdapter(adapter, config.cacheTtlMs);

  return createProjectIntelligence({
    github: cache(createGitHubProjectAdapter({
      owner: config.githubOwner,
      repos: config.githubRepos,
      http,
    })),
    opendq: cache(createOpenDQProjectAdapter({
      config,
      github: githubReader,
      http,
    })),
    dreamlogs: cache(createDreamLogsProjectAdapter({
      config,
      github: githubReader,
      http,
    })),
  });
}
