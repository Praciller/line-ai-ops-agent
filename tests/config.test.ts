import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('uses safe zero-cost defaults', () => {
    const config = loadConfig({});

    expect(config.serviceName).toBe('personal-ai-ops-line');
    expect(config.port).toBe(3000);
    expect(config.openRouterModel).toBe('openrouter/free');
  });

  it('rejects a paid OpenRouter model', () => {
    expect(() =>
      loadConfig({ OPENROUTER_MODEL: 'anthropic/claude-sonnet-4' }),
    ).toThrow(/free-only/i);
  });
});
