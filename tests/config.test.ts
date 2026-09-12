import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('uses safe zero-cost defaults with LINE disabled', () => {
    const config = loadConfig({});

    expect(config.serviceName).toBe('line-ai-ops-agent');
    expect(config.port).toBe(3000);
    expect(config.openRouterModel).toBe('openrouter/free');
    expect(config.line).toBeNull();
  });

  it('loads complete owner-only LINE configuration', () => {
    const config = loadConfig({
      LINE_CHANNEL_SECRET: 'channel-secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'access-token',
      LINE_OWNER_USER_IDS: ' U-owner-1, U-owner-2,U-owner-1 ',
    });

    expect(config.line).toEqual({
      channelSecret: 'channel-secret',
      channelAccessToken: 'access-token',
      ownerUserIds: ['U-owner-1', 'U-owner-2'],
    });
  });
  it('rejects partial LINE configuration', () => {
    expect(() =>
      loadConfig({ LINE_CHANNEL_SECRET: 'channel-secret' }),
    ).toThrow(/line configuration/i);
  });

  it('rejects a paid OpenRouter model', () => {
    expect(() =>
      loadConfig({ OPENROUTER_MODEL: 'anthropic/claude-sonnet-4' }),
    ).toThrow(/free-only/i);
  });
});