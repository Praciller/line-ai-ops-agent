import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';
import { parseCommand, routeCommand } from '../src/line/commands.js';

describe('parseCommand', () => {
  it('ignores ordinary chat text', () => {
    expect(parseCommand('hello there')).toBeNull();
  });

  it('recognizes supported commands case-insensitively', () => {
    expect(parseCommand(' /HELP ')).toEqual({ name: 'help' });
    expect(parseCommand('/status')).toEqual({ name: 'status' });
  });
});

describe('routeCommand', () => {
  it('renders help for unknown slash commands', () => {
    const result = routeCommand('/unknown', loadConfig({ NODE_ENV: 'test' }));

    expect(result).toMatch(/\/help/);
    expect(result).toMatch(/\/status/);
  });

  it('renders deterministic configured component status', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      LINE_CHANNEL_SECRET: 'secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'token',      LINE_OWNER_USER_IDS: 'U-owner',
    });

    const result = routeCommand('/status', config);

    expect(result).toContain('LINE: configured');
    expect(result).toContain('Database: not_configured');
    expect(result).toContain('AI: not_configured');
  });
});
