import { describe, expect, it } from 'vitest';

import { createGroqProvider } from '../src/ai/groq.js';
import { createOpenRouterProvider } from '../src/ai/openrouter.js';
import { AiProviderError } from '../src/ai/types.js';

type Captured = { url: string; init?: RequestInit };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function input() {
  return { question: 'What needs attention?', context: 'GitHub: ok', maxOutputTokens: 300 };
}

describe('free AI provider clients', () => {
  it('calls the fixed OpenRouter endpoint with the locked free model', async () => {
    const calls: Captured[] = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return json({ choices: [{ message: { content: 'All good.' } }] });
    };
    const provider = createOpenRouterProvider({ apiKey: 'or-secret', model: 'openrouter/free', timeoutMs: 1000, fetchImpl });
    const result = await provider.generate(input());

    expect(calls[0]?.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(new Headers(calls[0]?.init?.headers).get('authorization')).toBe('Bearer or-secret');
    expect(JSON.parse(String(calls[0]?.init?.body)).model).toBe('openrouter/free');
    expect(result).toMatchObject({ text: 'All good.', provider: 'openrouter', model: 'openrouter/free' });
  });
  it('calls the fixed Groq endpoint with the current free fallback model', async () => {
    const calls: Captured[] = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return json({ choices: [{ message: { content: 'Needs CI review.' } }] });
    };
    const provider = createGroqProvider({ apiKey: 'groq-secret', model: 'openai/gpt-oss-20b', timeoutMs: 1000, fetchImpl });
    const result = await provider.generate(input());

    expect(calls[0]?.url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(new Headers(calls[0]?.init?.headers).get('authorization')).toBe('Bearer groq-secret');
    expect(JSON.parse(String(calls[0]?.init?.body)).model).toBe('openai/gpt-oss-20b');
    expect(result.provider).toBe('groq');
  });

  it('records bounded latency without exposing secret material', async () => {
    let tick = 100;
    const provider = createOpenRouterProvider({
      apiKey: 'do-not-leak', model: 'openrouter/free', timeoutMs: 1000,
      fetchImpl: async () => json({ choices: [{ message: { content: 'ok' } }] }),
      now: () => (tick += 25),
    });
    const result = await provider.generate(input());
    expect(result.latencyMs).toBe(25);
    expect(JSON.stringify(result)).not.toContain('do-not-leak');
  });
  it('classifies empty provider content as invalid response', async () => {
    const provider = createGroqProvider({
      apiKey: 'x', model: 'openai/gpt-oss-20b', timeoutMs: 1000,
      fetchImpl: async () => json({ choices: [{ message: { content: '   ' } }] }),
    });
    await expect(provider.generate(input())).rejects.toMatchObject({ category: 'invalid_response' });
  });

  it.each([
    [429, 'rate_limited'],
    [503, 'server_error'],
  ] as const)('classifies HTTP %s without including provider response bodies', async (status, category) => {
    const provider = createOpenRouterProvider({
      apiKey: 'secret', model: 'openrouter/free', timeoutMs: 1000,
      fetchImpl: async () => new Response('sensitive upstream body', { status }),
    });
    try {
      await provider.generate(input());
      throw new Error('expected provider failure');
    } catch (error) {
      expect(error).toBeInstanceOf(AiProviderError);
      expect(error).toMatchObject({ category });
      expect(String(error)).not.toContain('sensitive upstream body');
      expect(String(error)).not.toContain('secret');
    }
  });
  it('classifies request timeout and aborts the provider call', async () => {
    const provider = createOpenRouterProvider({
      apiKey: 'x', model: 'openrouter/free', timeoutMs: 10,
      fetchImpl: async (_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted upstream details');
          error.name = 'AbortError';
          reject(error);
        });
      }),
    });
    await expect(provider.generate(input())).rejects.toMatchObject({ category: 'timeout' });
  });

  it('rejects unsafe model identifiers at the provider boundary too', () => {
    expect(() => createOpenRouterProvider({ apiKey: 'x', model: 'paid/model', timeoutMs: 1000 }))
      .toThrow(/free model/i);
    expect(() => createGroqProvider({ apiKey: 'x', model: 'llama-3.3-70b-versatile', timeoutMs: 1000 }))
      .toThrow(/free model/i);
  });
});
