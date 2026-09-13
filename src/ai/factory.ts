import type { AiConfig } from '../config.js';
import type { ObservabilityStore } from '../persistence/observability.js';
import type { ProjectIntelligence } from '../projects/intelligence.js';
import { createAiAskService, type AiAskService } from './ask.js';
import { createGroqProvider } from './groq.js';
import { createOpenRouterProvider } from './openrouter.js';
import { createAiRouter } from './router.js';
import type { AiProvider, AiProviderName } from './types.js';

type AiFactoryOptions = {
  observability?: ObservabilityStore;
};

export function createAiAskServiceFromConfig(
  config: AiConfig | null,
  projects: ProjectIntelligence,
  options: AiFactoryOptions = {},
): AiAskService {
  if (!config) {
    return createAiAskService({ projects, maxOutputTokens: 400 });
  }

  const providers: Partial<Record<AiProviderName, AiProvider>> = {};
  if (config.openRouter) {
    providers.openrouter = createOpenRouterProvider({
      ...config.openRouter,
      timeoutMs: config.requestTimeoutMs,
    });
  }
  if (config.groq) {
    providers.groq = createGroqProvider({
      ...config.groq,
      timeoutMs: config.requestTimeoutMs,
    });
  }

  const router = createAiRouter({
    providers,
    providerOrder: config.providerOrder,
    telemetry: options.observability,
  });

  return createAiAskService({
    projects,
    router,
    maxOutputTokens: config.maxOutputTokens,
  });
}
