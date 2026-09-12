import type { ProjectHttpClient } from './http.js';
import type { ProjectAdapter, ProjectStatus } from './types.js';

const GITHUB_API_BASE = 'https://api.github.com';
const slugPattern = /^[A-Za-z0-9_.-]+$/;
const githubHeaders = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'line-ai-ops-agent',
  'X-GitHub-Api-Version': '2026-03-10',
};

export type GitHubRepoSummary = {
  repo: string;
  defaultBranch: string;
  pushedAt: string | null;
  openPullRequests: number;
  openPullRequestsCapped: boolean;
  workflowState: string;
};

export interface GitHubRepositoryReader {
  getRepositorySummary(repo: string): Promise<GitHubRepoSummary>;
}

type GitHubRepositoryReaderOptions = {
  owner: string;
  http: ProjectHttpClient;
};
function assertSlug(value: string, label: string): void {
  if (!slugPattern.test(value)) {
    throw new Error(`Unsafe GitHub ${label}`);
  }
}

async function readJson<T>(
  http: ProjectHttpClient,
  url: string,
): Promise<T> {
  const response = await http.request(url, { headers: githubHeaders });
  if (!response.ok) {
    throw new Error(`GitHub read failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}
export function createGitHubRepositoryReader(
  options: GitHubRepositoryReaderOptions,
): GitHubRepositoryReader {
  assertSlug(options.owner, 'owner');

  return {
    async getRepositorySummary(repo: string): Promise<GitHubRepoSummary> {
      assertSlug(repo, 'repository');
      const root = `${GITHUB_API_BASE}/repos/${options.owner}/${repo}`;
      const metadata = await readJson<{
        default_branch?: string;
        pushed_at?: string | null;
      }>(options.http, root);
      const pullRequests = await readJson<unknown[]>(
        options.http,
        `${root}/pulls?state=open&per_page=5`,
      );
      const runs = await readJson<{
        workflow_runs?: Array<{ status?: string; conclusion?: string | null }>;
      }>(options.http, `${root}/actions/runs?per_page=1`);
      const latestRun = runs.workflow_runs?.[0];

      return {
        repo,
        defaultBranch: metadata.default_branch ?? 'unknown',
        pushedAt: metadata.pushed_at ?? null,
        openPullRequests: Math.min(pullRequests.length, 5),
        openPullRequestsCapped: pullRequests.length >= 5,
        workflowState: latestRun?.conclusion ?? latestRun?.status ?? 'none',
      };
    },
  };
}
type GitHubProjectAdapterOptions = {
  owner: string;
  repos: readonly string[];
  http: ProjectHttpClient;
  now?: () => Date;
};

function renderRepo(summary: GitHubRepoSummary): string {
  const prSuffix = summary.openPullRequestsCapped ? '+' : '';
  return `${summary.repo}: ${summary.defaultBranch} · PRs ${summary.openPullRequests}${prSuffix} · CI ${summary.workflowState}`;
}

export function createGitHubProjectAdapter(
  options: GitHubProjectAdapterOptions,
): ProjectAdapter {
  const reader = createGitHubRepositoryReader({ owner: options.owner, http: options.http });
  const repos = [...options.repos];
  repos.forEach((repo) => assertSlug(repo, 'repository'));
  const now = options.now ?? (() => new Date());
  return {
    async getStatus(): Promise<ProjectStatus> {
      const results = await Promise.allSettled(
        repos.map((repo) => reader.getRepositorySummary(repo)),
      );
      const details = results.map((result, index) =>
        result.status === 'fulfilled'
          ? renderRepo(result.value)
          : `${repos[index]}: temporarily unavailable`,
      );
      const readable = results.filter((result) => result.status === 'fulfilled').length;
      const state = readable === repos.length ? 'ok' : readable === 0 ? 'unavailable' : 'degraded';

      return {
        key: 'github',
        title: 'GitHub',
        state,
        summary: `${readable}/${repos.length} repositories readable`,
        details,
        capturedAt: now().toISOString(),
      };
    },
  };
}
