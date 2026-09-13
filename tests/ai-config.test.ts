import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';
import { buildHealthReport } from '../src/health.js';

describe('free-only AI configuration', () => {
  it('keeps AI disabled when no provider key is configured', () => {
    const config = loadConfig({ NODE_ENV: 'test' });
    expect(config.ai).toBeNull();
  });

  it('loads OpenRouter Free as the primary default', () => {
    const config = loadConfig({ NODE_ENV: 'test', OPENROUTER_API_KEY: 'or-secret' });
    expect(config.ai).toMatchObject({
      openRouter: { apiKey: 'or-secret', model: 'openrouter/free' },
      groq: null,
      providerOrder: ['openrouter', 'groq'],
      requestTimeoutMs: 8000,
      maxOutputTokens: 400,
    });
  });

  it('loads the current Groq Free fallback model only', () => {
    const config = loadConfig({ NODE_ENV: 'test', GROQ_API_KEY: 'groq-secret' });
    expect(config.ai?.groq).toEqual({ apiKey: 'groq-secret', model: 'openai/gpt-oss-20b' });
  });
  it('allows only unique known provider-order tokens', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      GROQ_API_KEY: 'groq-secret',
      AI_PROVIDER_ORDER: 'groq,openrouter',
    });
    expect(config.ai?.providerOrder).toEqual(['groq', 'openrouter']);
    expect(() => loadConfig({ OPENROUTER_API_KEY: 'x', AI_PROVIDER_ORDER: 'openrouter,openrouter' }))
      .toThrow(/provider order/i);
    expect(() => loadConfig({ OPENROUTER_API_KEY: 'x', AI_PROVIDER_ORDER: 'openrouter,other' }))
      .toThrow(/provider order/i);
  });

  it('rejects non-free model overrides', () => {
    expect(() => loadConfig({ GROQ_API_KEY: 'x', GROQ_MODEL: 'llama-3.3-70b-versatile' }))
      .toThrow(/free-only/i);
    expect(() => loadConfig({ OPENROUTER_API_KEY: 'x', OPENROUTER_MODEL: 'openai/gpt-4.1' }))
      .toThrow(/free-only/i);
  });

  it('bounds timeout and output token configuration', () => {
    expect(() => loadConfig({ OPENROUTER_API_KEY: 'x', AI_REQUEST_TIMEOUT_MS: '500' }))
      .toThrow(/timeout/i);
    expect(() => loadConfig({ OPENROUTER_API_KEY: 'x', AI_MAX_OUTPUT_TOKENS: '2048' }))
      .toThrow(/output/i);
  });
  it('does not expose configured provider secrets through health output', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      OPENROUTER_API_KEY: 'top-secret-openrouter',
      GROQ_API_KEY: 'top-secret-groq',
    });
    const rendered = JSON.stringify(buildHealthReport(config));
    expect(rendered).not.toContain('top-secret-openrouter');
    expect(rendered).not.toContain('top-secret-groq');
  });
});
