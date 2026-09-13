import { createChatCompletionProvider, type AiFetch } from './http.js';
import type { AiProvider } from './types.js';

type GroqProviderOptions = {
  apiKey: string;
  model: string;
  timeoutMs: number;
  fetchImpl?: AiFetch;
  now?: () => number;
};

export function createGroqProvider(options: GroqProviderOptions): AiProvider {
  return createChatCompletionProvider({
    provider: 'groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    expectedModel: 'openai/gpt-oss-20b',
    ...options,
  });
}
