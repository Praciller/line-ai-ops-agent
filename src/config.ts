import { z } from 'zod';

const slugPattern = /^[A-Za-z0-9_.-]+$/;

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function parseOwnerUserIds(value: string | undefined): string[] {
  return parseCsv(value);
}

export type AiProviderName = 'openrouter' | 'groq';

function parseProviderOrder(value: string): AiProviderName[] {
  const items = value.split(',').map((item) => item.trim()).filter(Boolean);
  const allowed = new Set<AiProviderName>(['openrouter', 'groq']);
  if (items.length === 0 || items.some((item) => !allowed.has(item as AiProviderName)) || new Set(items).size !== items.length) {
    throw new Error('AI provider order must contain unique openrouter/groq tokens only');
  }
  return items as AiProviderName[];
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
  OPENROUTER_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('openai/gpt-oss-20b').refine(
    (value) => value === 'openai/gpt-oss-20b',
    { message: 'Free-only policy requires GROQ_MODEL=openai/gpt-oss-20b' },
  ),
  AI_PROVIDER_ORDER: z.string().default('openrouter,groq'),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000, {
    message: 'AI request timeout must be at least 1000ms',
  }).max(15000, { message: 'AI request timeout must be at most 15000ms' }).default(8000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(64, {
    message: 'AI max output tokens must be at least 64',
  }).max(1024, { message: 'AI max output tokens must be at most 1024' }).default(400),
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
  MESSAGE_MONTHLY_HARD_LIMIT: z.coerce.number().int().min(1, {
    message: 'Message monthly hard limit must be at least 1',
  }).max(300, { message: 'Message monthly hard limit must be at most 300' }).default(250),
  MESSAGE_DAILY_PROACTIVE_HARD_LIMIT: z.coerce.number().int().min(1, {
    message: 'Message daily proactive hard limit must be at least 1',
  }).max(300, { message: 'Message daily proactive hard limit must be at most 300' }).default(5),
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

export type AiProviderConfig = {
  apiKey: string;
  model: string;
};

export type AiConfig = {
  openRouter: AiProviderConfig | null;
  groq: AiProviderConfig | null;
  providerOrder: readonly AiProviderName[];
  requestTimeoutMs: number;
  maxOutputTokens: number;
};

export type MessageBudgetConfig = {
  monthlyHardLimit: number;
  dailyProactiveHardLimit: number;
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
  ai: AiConfig | null;
  messageBudget: MessageBudgetConfig;
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
  const providerOrder = parseProviderOrder(parsed.AI_PROVIDER_ORDER);
  const openRouter = parsed.OPENROUTER_API_KEY
    ? { apiKey: parsed.OPENROUTER_API_KEY, model: parsed.OPENROUTER_MODEL }
    : null;
  const groq = parsed.GROQ_API_KEY
    ? { apiKey: parsed.GROQ_API_KEY, model: parsed.GROQ_MODEL }
    : null;
  const ai = openRouter || groq
    ? { openRouter, groq, providerOrder, requestTimeoutMs: parsed.AI_REQUEST_TIMEOUT_MS, maxOutputTokens: parsed.AI_MAX_OUTPUT_TOKENS }
    : null;

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    serviceName: parsed.SERVICE_NAME,
    logLevel: parsed.LOG_LEVEL,
    openRouterModel: parsed.OPENROUTER_MODEL,
    line,
    database,
    ai,
    messageBudget: {
      monthlyHardLimit: parsed.MESSAGE_MONTHLY_HARD_LIMIT,
      dailyProactiveHardLimit: parsed.MESSAGE_DAILY_PROACTIVE_HARD_LIMIT,
    },
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