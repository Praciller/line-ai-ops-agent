import { describe, expect, it } from 'vitest';

import { createAiRouter, AiUnavailableError } from '../src/ai/router.js';
import { AiProviderError, type AiProvider, type AiProviderName } from '../src/ai/types.js';
import type { ProviderOutcomeInput } from '../src/persistence/observability.js';

function provider(
  name: AiProviderName,
  model: string,
  run: AiProvider['generate'],
): AiProvider {
  return { name, model, generate: run };
}

const input = { question: 'What needs attention?', context: 'GitHub: ok', maxOutputTokens: 300 };

describe('free AI router', () => {
  it('returns the first successful configured provider', async () => {
    const openrouter = provider('openrouter', 'openrouter/free', async () => ({
      text: 'OpenRouter answer', provider: 'openrouter', model: 'openrouter/free', latencyMs: 12,
    }));
    const router = createAiRouter({ providers: { openrouter }, providerOrder: ['openrouter', 'groq'] });

    await expect(router.ask(input)).resolves.toEqual({
      text: 'OpenRouter answer', providerUsed: 'openrouter', model: 'openrouter/free',
    });
  });

  it('falls back from OpenRouter rate limit to Groq', async () => {
    const openrouter = provider('openrouter', 'openrouter/free', async () => {
      throw new AiProviderError('openrouter', 'openrouter/free', 'rate_limited', 429);
    });
    const groq = provider('groq', 'openai/gpt-oss-20b', async () => ({
      text: 'Groq answer', provider: 'groq', model: 'openai/gpt-oss-20b', latencyMs: 8,
    }));
    const router = createAiRouter({ providers: { openrouter, groq }, providerOrder: ['openrouter', 'groq'] });

    await expect(router.ask(input)).resolves.toMatchObject({
      text: 'Groq answer', providerUsed: 'groq', model: 'openai/gpt-oss-20b',
    });
  });

  it('falls back after timeout and skips unavailable providers', async () => {
    const groq = provider('groq', 'openai/gpt-oss-20b', async () => ({
      text: 'Only configured provider', provider: 'groq', model: 'openai/gpt-oss-20b', latencyMs: 4,
    }));
    const router = createAiRouter({ providers: { groq }, providerOrder: ['openrouter', 'groq'] });
    await expect(router.ask(input)).resolves.toMatchObject({ providerUsed: 'groq' });
  });

  it('respects configured provider order', async () => {
    const calls: AiProviderName[] = [];
    const openrouter = provider('openrouter', 'openrouter/free', async () => {
      calls.push('openrouter');
      return { text: 'or', provider: 'openrouter', model: 'openrouter/free', latencyMs: 1 };
    });
    const groq = provider('groq', 'openai/gpt-oss-20b', async () => {
      calls.push('groq');
      return { text: 'groq', provider: 'groq', model: 'openai/gpt-oss-20b', latencyMs: 1 };
    });
    const router = createAiRouter({ providers: { openrouter, groq }, providerOrder: ['groq', 'openrouter'] });

    const result = await router.ask(input);
    expect(result.providerUsed).toBe('groq');
    expect(calls).toEqual(['groq']);
  });

  it('throws a typed unavailable error when all configured providers fail', async () => {
    const openrouter = provider('openrouter', 'openrouter/free', async () => {
      throw new AiProviderError('openrouter', 'openrouter/free', 'server_error', 503);
    });
    const router = createAiRouter({ providers: { openrouter }, providerOrder: ['openrouter', 'groq'] });

    await expect(router.ask(input)).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it('records provider metadata only and keeps telemetry best-effort', async () => {
    const records: ProviderOutcomeInput[] = [];
    const telemetry = {
      async recordProviderOutcome(record: ProviderOutcomeInput) {
        records.push(record);
        if (records.length === 1) throw new Error('telemetry unavailable');
      },
    };
    const openrouter = provider('openrouter', 'openrouter/free', async () => {
      throw new AiProviderError('openrouter', 'openrouter/free', 'rate_limited', 429);
    });
    const groq = provider('groq', 'openai/gpt-oss-20b', async () => ({
      text: 'safe answer', provider: 'groq', model: 'openai/gpt-oss-20b', latencyMs: 7,
    }));
    const router = createAiRouter({
      providers: { openrouter, groq }, providerOrder: ['openrouter', 'groq'], telemetry,
      now: () => Date.parse('2026-09-13T05:00:00Z'),
    });

    await expect(router.ask(input)).resolves.toMatchObject({ providerUsed: 'groq' });
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ provider: 'openrouter', model: 'openrouter/free', outcome: 'error', errorClass: 'rate_limited' });
    expect(records[1]).toMatchObject({ provider: 'groq', model: 'openai/gpt-oss-20b', outcome: 'success', errorClass: null });
    expect(JSON.stringify(records)).not.toContain(input.question);
    expect(JSON.stringify(records)).not.toContain(input.context);
  });
});
