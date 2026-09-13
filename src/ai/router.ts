import type { ProviderOutcomeInput } from '../persistence/observability.js';
import { AiProviderError, type AiGenerateInput, type AiProvider, type AiProviderName } from './types.js';

export type AiRouterResult = {
  text: string;
  providerUsed: AiProviderName;
  model: string;
};

export interface AiRouter {
  ask(input: AiGenerateInput): Promise<AiRouterResult>;
}

export class AiUnavailableError extends Error {
  constructor() {
    super('AI providers unavailable');
    this.name = 'AiUnavailableError';
  }
}

type ProviderTelemetry = {
  recordProviderOutcome(input: ProviderOutcomeInput): Promise<void>;
};

type AiRouterOptions = {
  providers: Partial<Record<AiProviderName, AiProvider>>;
  providerOrder: readonly AiProviderName[];
  telemetry?: ProviderTelemetry;
  now?: () => number;
};

async function safeTelemetry(
  telemetry: ProviderTelemetry | undefined,
  input: ProviderOutcomeInput,
): Promise<void> {
  if (!telemetry) return;
  try {
    await telemetry.recordProviderOutcome(input);
  } catch {
    // Provider telemetry is best-effort and must never block the owner command.
  }
}

function errorClass(error: unknown): string {
  if (error instanceof AiProviderError) return error.category;
  if (error instanceof Error && error.name) return error.name;
  return 'unknown_error';
}

export function createAiRouter(options: AiRouterOptions): AiRouter {
  const now = options.now ?? Date.now;

  return {
    async ask(input: AiGenerateInput): Promise<AiRouterResult> {
      for (const providerName of options.providerOrder) {
        const provider = options.providers[providerName];
        if (!provider) continue;
        const started = now();
        try {
          const result = await provider.generate(input);
          await safeTelemetry(options.telemetry, {
            provider: result.provider,
            model: result.model,
            outcome: 'success',
            latencyMs: result.latencyMs,
            errorClass: null,
            recordedAt: new Date(now()).toISOString(),
          });
          return {
            text: result.text,
            providerUsed: result.provider,
            model: result.model,
          };
        } catch (error) {
          await safeTelemetry(options.telemetry, {
            provider: provider.name,
            model: provider.model,
            outcome: 'error',
            latencyMs: Math.max(0, now() - started),
            errorClass: errorClass(error),
            recordedAt: new Date(now()).toISOString(),
          });
        }
      }
      throw new AiUnavailableError();
    },
  };
}
