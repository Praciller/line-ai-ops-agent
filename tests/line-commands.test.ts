import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';
import * as commands from '../src/line/commands.js';
import type { ProjectIntelligence } from '../src/projects/intelligence.js';

const intelligence: ProjectIntelligence = {
  github: async () => 'github-result',
  opendq: async () => 'opendq-result',
  dreamlogs: async () => 'dreamlogs-result',
  today: async () => 'today-result',
};

describe('parseCommand', () => {
  it('ignores ordinary chat text', () => {
    expect(commands.parseCommand('hello there')).toBeNull();
  });

  it('recognizes every supported command case-insensitively', () => {
    expect(commands.parseCommand(' /HELP ')).toEqual({ name: 'help' });
    expect(commands.parseCommand('/status')).toEqual({ name: 'status' });
    expect(commands.parseCommand('/GITHUB')).toEqual({ name: 'github' });
    expect(commands.parseCommand('/opendq')).toEqual({ name: 'opendq' });
    expect(commands.parseCommand('/dreamlogs')).toEqual({ name: 'dreamlogs' });
    expect(commands.parseCommand('/today')).toEqual({ name: 'today' });
  });
});
describe('command execution', () => {
  it('renders help for unknown slash commands', () => {
    const result = commands.routeCommand('/unknown', loadConfig({ NODE_ENV: 'test' }));
    expect(result).toMatch(/\/help/);
    expect(result).toMatch(/\/status/);
  });

  it('renders deterministic configured component status', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      LINE_CHANNEL_SECRET: 'secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'token',
      LINE_OWNER_USER_IDS: 'U-owner',
    });
    expect(commands.routeCommand('/status', config)).toContain('LINE: configured');
  });

  it('executes read-only project commands through injected intelligence', async () => {
    const executeCommand = (commands as unknown as {
      executeCommand?: (text: string, config: ReturnType<typeof loadConfig>, projects: ProjectIntelligence) => Promise<string | null>;
    }).executeCommand;
    expect(typeof executeCommand).toBe('function');
    const config = loadConfig({ NODE_ENV: 'test' });
    expect(await executeCommand?.('/github', config, intelligence)).toBe('github-result');
    expect(await executeCommand?.('/today', config, intelligence)).toBe('today-result');
  });
});


describe('/ask command parsing', () => {
  it('preserves the question while matching the command case-insensitively', () => {
    expect(commands.parseCommand('/ASK What Needs Attention?')).toEqual({
      name: 'ask',
      question: 'What Needs Attention?',
    });
  });

  it('represents a missing question explicitly and documents ask in help', () => {
    expect(commands.parseCommand('/ask')).toEqual({ name: 'ask', question: '' });
    expect(commands.renderHelp()).toContain('/ask <question>');
  });
});


describe('/jobs command parsing', () => {
  it('recognizes jobs case-insensitively and documents it in help', () => {
    expect(commands.parseCommand('/JOBS')).toEqual({ name: 'jobs' });
    expect(commands.renderHelp()).toContain('/jobs');
  });
});
