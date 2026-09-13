import {
  AiProviderError,
  type AiGenerateInput,
  type AiProvider,
  type AiProviderName,
} from './types.js';
import { buildAiUserPrompt } from './prompt.js';

export type AiFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type ChatProviderOptions = {
  provider: AiProviderName;
  endpoint: string;
  expectedModel: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  fetchImpl?: AiFetch;
  now?: () => number;
};

function classifyStatus(status: number): AiProviderError['category'] {
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server_error';
  return 'http_error';
}

function buildBody(model: string, input: AiGenerateInput) {
  return {
    model,
    messages: [
      {
        role: 'system',
        content: 'Answer concisely using only the supplied deterministic project context.',
      },
      {
        role: 'user',
        content: buildAiUserPrompt(input.question, input.context),
      },
    ],
    max_tokens: input.maxOutputTokens,
    temperature: 0.2,
  };
}

function readContent(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return null;
  const message = choices[0] && typeof choices[0] === 'object'
    ? (choices[0] as { message?: unknown }).message
    : null;
  if (!message || typeof message !== 'object') return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' && content.trim() ? content.trim() : null;
}

export function createChatCompletionProvider(options: ChatProviderOptions): AiProvider {
  if (options.model !== options.expectedModel) {
    throw new Error(`${options.provider} free model must be ${options.expectedModel}`);
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;

  return {
    name: options.provider,
    model: options.model,
    async generate(input: AiGenerateInput) {
      const started = now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        const response = await fetchImpl(options.endpoint, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(buildBody(options.model, input)),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new AiProviderError(
            options.provider,
            options.model,
            classifyStatus(response.status),
            response.status,
          );
        }

        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new AiProviderError(options.provider, options.model, 'invalid_response');
        }
        const text = readContent(payload);
        if (!text) {
          throw new AiProviderError(options.provider, options.model, 'invalid_response');
        }
        return {
          text,
          provider: options.provider,
          model: options.model,
          latencyMs: Math.max(0, now() - started),
        };
      } catch (error) {
        if (error instanceof AiProviderError) throw error;
        const category = error instanceof Error && error.name === 'AbortError'
          ? 'timeout'
          : 'network_error';
        throw new AiProviderError(options.provider, options.model, category);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
