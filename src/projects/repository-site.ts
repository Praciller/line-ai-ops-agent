import type { GitHubRepositoryReader } from './github.js';
import type { ProjectHttpClient } from './http.js';
import type { ProjectAdapter, ProjectKey, ProjectStatus } from './types.js';

type RepositorySiteAdapterOptions = {
  key: Exclude<ProjectKey, 'github'>;
  title: string;
  repo: string;
  statusUrl: string;
  github: GitHubRepositoryReader;
  http: ProjectHttpClient;
  now?: () => Date;
};

function repoDetail(branch: string, prs: number, capped: boolean, workflow: string): string {
  return `Repository: ${branch} · PRs ${prs}${capped ? '+' : ''} · CI ${workflow}`;
}
export function createRepositorySiteAdapter(
  options: RepositorySiteAdapterOptions,
): ProjectAdapter {
  const now = options.now ?? (() => new Date());

  return {
    async getStatus(): Promise<ProjectStatus> {
      const [repoResult, siteResult] = await Promise.allSettled([
        options.github.getRepositorySummary(options.repo),
        options.http.request(options.statusUrl),
      ]);
      const repoReadable = repoResult.status === 'fulfilled';
      const siteReachable = siteResult.status === 'fulfilled' && siteResult.value.ok;
      const details = [
        repoReadable
          ? repoDetail(
              repoResult.value.defaultBranch,
              repoResult.value.openPullRequests,
              repoResult.value.openPullRequestsCapped,
              repoResult.value.workflowState,
            )
          : 'Repository: temporarily unavailable',
        siteReachable ? 'Site: reachable' : 'Site: temporarily unavailable',
      ];

      const state = repoReadable && siteReachable
        ? 'ok'
        : repoReadable || siteReachable
          ? 'degraded'
          : 'unavailable';
      const summary = repoReadable
        ? `repository readable · site ${siteReachable ? 'reachable' : 'unavailable'}`
        : `repository unavailable · site ${siteReachable ? 'reachable' : 'unavailable'}`;

      return {
        key: options.key,
        title: options.title,
        state,
        summary,
        details,
        capturedAt: now().toISOString(),
      };
    },
  };
}
