import type { ProjectConfig } from '../config.js';
import type { GitHubRepositoryReader } from './github.js';
import type { ProjectHttpClient } from './http.js';
import { createRepositorySiteAdapter } from './repository-site.js';

export function createOpenDQProjectAdapter(options: {
  config: ProjectConfig;
  github: GitHubRepositoryReader;
  http: ProjectHttpClient;
}) {
  return createRepositorySiteAdapter({
    key: 'opendq',
    title: 'OpenDQ',
    repo: 'opendq-observatory',
    statusUrl: options.config.opendqUrl,
    github: options.github,
    http: options.http,
  });
}
