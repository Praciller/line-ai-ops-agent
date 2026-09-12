import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  SERVICE_NAME: z.string().min(1).default('personal-ai-ops-line'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  OPENROUTER_MODEL: z
    .string()
    .default('openrouter/free')
    .refine((value) => value === 'openrouter/free', {
      message: 'Free-only policy requires OPENROUTER_MODEL=openrouter/free',
    }),
});

export type AppConfig = {
  nodeEnv: z.infer<typeof envSchema>['NODE_ENV'];
  port: number;
  serviceName: string;
  logLevel: z.infer<typeof envSchema>['LOG_LEVEL'];
  openRouterModel: string;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.parse(env);
  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    serviceName: parsed.SERVICE_NAME,
    logLevel: parsed.LOG_LEVEL,
    openRouterModel: parsed.OPENROUTER_MODEL,
  };
}
