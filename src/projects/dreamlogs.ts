import type { ProjectConfig } from '../config.js';
import type { GitHubRepositoryReader } from './github.js';
import type { ProjectHttpClient } from './http.js';
import { createRepositorySiteAdapter } from './repository-site.js';

export function createDreamLogsProjectAdapter(options: {
  config: ProjectConfig;
  github: GitHubRepositoryReader;
  http: ProjectHttpClient;
}) {
  return createRepositorySiteAdapter({
    key: 'dreamlogs',
    title: 'Dream Logs',
    repo: 'dreamlogsdata',
    statusUrl: options.config.dreamlogsUrl,
    github: options.github,
    http: options.http,
  });
}
