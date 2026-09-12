import { z } from 'zod';

const slugPattern = /^[A-Za-z0-9_.-]+$/;

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function parseOwnerUserIds(value: string | undefined): string[] {
  return parseCsv(value);
}

function parseRepositorySlugs(value: string): string[] {
  const repos = parseCsv(value);
  if (repos.length === 0 || repos.some((repo) => !slugPattern.test(repo))) {
    throw new Error('Project repository allowlist must contain repository slugs only');
  }
  return repos;
}

function requireHttpsUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') throw new Error('Project status URLs must use HTTPS');
  return parsed.toString();
}

function requirePostgresUrl(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
      throw new Error('Database URL must use PostgreSQL protocol');
    }
    return value;
  } catch (error) {
    if (error instanceof Error && /PostgreSQL protocol/.test(error.message)) throw error;
    throw new Error('Database URL must be a valid PostgreSQL URL');
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  SERVICE_NAME: z.string().min(1).default('line-ai-ops-agent'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  OPENROUTER_MODEL: z.string().default('openrouter/free').refine(
    (value) => value === 'openrouter/free',
    { message: 'Free-only policy requires OPENROUTER_MODEL=openrouter/free' },
  ),
  LINE_CHANNEL_SECRET: z.string().optional(),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().optional(),
  LINE_OWNER_USER_IDS: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(500, {
    message: 'Database connect timeout must be at least 500ms',
  }).max(10000, { message: 'Database connect timeout must be at most 10000ms' }).default(3000),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1, {
    message: 'Database pool max must be at least 1',
  }).max(5, { message: 'Database pool max must be at most 5' }).default(3),
  PROJECT_GITHUB_OWNER: z.string().default('Praciller'),
  PROJECT_GITHUB_REPOS: z.string().default('line-ai-ops-agent,opendq-observatory,dreamlogsdata'),
  OPENDQ_STATUS_URL: z.string().default('https://opendq-observatory.vercel.app/'),
  DREAMLOGS_STATUS_URL: z.string().default('https://dreamlogsdata.com/'),
  PROJECT_HTTP_TIMEOUT_MS: z.coerce.number().int().min(500, {
    message: 'Project HTTP timeout must be at least 500ms',
  }).max(10000, { message: 'Project HTTP timeout must be at most 10000ms' }).default(4000),
  PROJECT_CACHE_TTL_MS: z.coerce.number().int().min(10000, {
    message: 'Project cache TTL must be at least 10000ms',
  }).max(3600000, { message: 'Project cache TTL must be at most 3600000ms' }).default(300000),
}).superRefine((value, context) => {
  const ownerIds = parseOwnerUserIds(value.LINE_OWNER_USER_IDS);
  const anyLineValue = Boolean(value.LINE_CHANNEL_SECRET || value.LINE_CHANNEL_ACCESS_TOKEN || value.LINE_OWNER_USER_IDS);
  const complete = Boolean(value.LINE_CHANNEL_SECRET && value.LINE_CHANNEL_ACCESS_TOKEN && ownerIds.length > 0);
  if (anyLineValue && !complete) {
    context.addIssue({
      code: 'custom',
      message: 'LINE configuration requires channel secret, access token, and owner user IDs',
    });
  }
});

export type LineConfig = {
  channelSecret: string;
  channelAccessToken: string;
  ownerUserIds: readonly string[];
};

export type DatabaseConfig = {
  url: string;
  connectTimeoutMs: number;
  poolMax: number;
};

export type ProjectConfig = {
  githubOwner: string;
  githubRepos: readonly string[];
  opendqUrl: string;
  dreamlogsUrl: string;
  requestTimeoutMs: number;
  cacheTtlMs: number;
};

export type AppConfig = {
  nodeEnv: z.infer<typeof envSchema>['NODE_ENV'];
  port: number;
  serviceName: string;
  logLevel: z.infer<typeof envSchema>['LOG_LEVEL'];
  openRouterModel: string;
  line: LineConfig | null;
  database: DatabaseConfig | null;
  projects: ProjectConfig;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.parse(env);
  if (!slugPattern.test(parsed.PROJECT_GITHUB_OWNER)) {
    throw new Error('Project GitHub owner must be a repository owner slug');
  }
  const githubRepos = parseRepositorySlugs(parsed.PROJECT_GITHUB_REPOS);
  const opendqUrl = requireHttpsUrl(parsed.OPENDQ_STATUS_URL);
  const dreamlogsUrl = requireHttpsUrl(parsed.DREAMLOGS_STATUS_URL);
  const ownerUserIds = parseOwnerUserIds(parsed.LINE_OWNER_USER_IDS);
  const line = parsed.LINE_CHANNEL_SECRET && parsed.LINE_CHANNEL_ACCESS_TOKEN && ownerUserIds.length > 0
    ? { channelSecret: parsed.LINE_CHANNEL_SECRET, channelAccessToken: parsed.LINE_CHANNEL_ACCESS_TOKEN, ownerUserIds }
    : null;
  const database = parsed.DATABASE_URL
    ? { url: requirePostgresUrl(parsed.DATABASE_URL), connectTimeoutMs: parsed.DATABASE_CONNECT_TIMEOUT_MS, poolMax: parsed.DATABASE_POOL_MAX }
    : null;

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    serviceName: parsed.SERVICE_NAME,
    logLevel: parsed.LOG_LEVEL,
    openRouterModel: parsed.OPENROUTER_MODEL,
    line,
    database,
    projects: {
      githubOwner: parsed.PROJECT_GITHUB_OWNER,
      githubRepos,
      opendqUrl,
      dreamlogsUrl,
      requestTimeoutMs: parsed.PROJECT_HTTP_TIMEOUT_MS,
      cacheTtlMs: parsed.PROJECT_CACHE_TTL_MS,
    },
  };
}