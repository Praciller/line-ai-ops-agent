import { createChatCompletionProvider, type AiFetch } from './http.js';
import type { AiProvider } from './types.js';

type OpenRouterProviderOptions = {
  apiKey: string;
  model: string;
  timeoutMs: number;
  fetchImpl?: AiFetch;
  now?: () => number;
};

export function createOpenRouterProvider(options: OpenRouterProviderOptions): AiProvider {
  return createChatCompletionProvider({
    provider: 'openrouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    expectedModel: 'openrouter/free',
    ...options,
  });
}
