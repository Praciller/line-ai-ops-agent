import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  SERVICE_NAME: z.string().min(1).default('line-ai-ops-agent'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  OPENROUTER_MODEL: z
    .string()
    .default('openrouter/free')
    .refine((value) => value === 'openrouter/free', {
      message: 'Free-only policy requires OPENROUTER_MODEL=openrouter/free',
    }),
  LINE_CHANNEL_SECRET: z.string().optional(),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().optional(),
  LINE_OWNER_USER_IDS: z.string().optional(),
}).superRefine((value, context) => {
  const ownerIds = parseOwnerUserIds(value.LINE_OWNER_USER_IDS);
  const anyLineValue = Boolean(
    value.LINE_CHANNEL_SECRET || value.LINE_CHANNEL_ACCESS_TOKEN || value.LINE_OWNER_USER_IDS,
  );
  const complete = Boolean(
    value.LINE_CHANNEL_SECRET && value.LINE_CHANNEL_ACCESS_TOKEN && ownerIds.length > 0,
  );

  if (anyLineValue && !complete) {
    context.addIssue({
      code: 'custom',
      message: 'LINE configuration requires channel secret, access token, and owner user IDs',
    });
  }
});
function parseOwnerUserIds(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

export type LineConfig = {
  channelSecret: string;
  channelAccessToken: string;
  ownerUserIds: readonly string[];
};

export type AppConfig = {
  nodeEnv: z.infer<typeof envSchema>['NODE_ENV'];
  port: number;
  serviceName: string;
  logLevel: z.infer<typeof envSchema>['LOG_LEVEL'];
  openRouterModel: string;
  line: LineConfig | null;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.parse(env);
  const ownerUserIds = parseOwnerUserIds(parsed.LINE_OWNER_USER_IDS);
  const line = parsed.LINE_CHANNEL_SECRET && parsed.LINE_CHANNEL_ACCESS_TOKEN && ownerUserIds.length > 0
    ? {
        channelSecret: parsed.LINE_CHANNEL_SECRET,
        channelAccessToken: parsed.LINE_CHANNEL_ACCESS_TOKEN,
        ownerUserIds,
      }
    : null;
  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    serviceName: parsed.SERVICE_NAME,
    logLevel: parsed.LOG_LEVEL,
    openRouterModel: parsed.OPENROUTER_MODEL,
    line,
  };
}
