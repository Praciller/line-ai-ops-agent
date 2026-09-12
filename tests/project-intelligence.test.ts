import { describe, expect, it } from 'vitest';

import { createProjectIntelligence } from '../src/projects/intelligence.js';
import type { ProjectAdapter, ProjectStatus } from '../src/projects/types.js';

function status(
  key: ProjectStatus['key'],
  title: string,
  summary: string,
  state: ProjectStatus['state'] = 'ok',
): ProjectStatus {
  return {
    key,
    title,
    state,
    summary,
    details: [],
    capturedAt: '2026-09-12T00:00:00.000Z',
  };
}

function adapter(value: ProjectStatus, delayMs = 0): ProjectAdapter {
  return {
    async getStatus() {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      return value;
    },
  };
}
function failingAdapter(message: string): ProjectAdapter {
  return {
    async getStatus() {
      throw new Error(message);
    },
  };
}

function intelligence(overrides: Partial<Record<'github' | 'opendq' | 'dreamlogs', ProjectAdapter>> = {}) {
  return createProjectIntelligence({
    github: overrides.github ?? adapter(status('github', 'GitHub', '3/3 repositories readable')),
    opendq: overrides.opendq ?? adapter(status('opendq', 'OpenDQ', 'repository readable - site reachable')),
    dreamlogs: overrides.dreamlogs ?? adapter(status('dreamlogs', 'Dream Logs', 'repository readable - site reachable')),
  });
}

describe('ProjectIntelligence', () => {
  it('renders all project summaries in deterministic order', async () => {
    const service = intelligence({
      github: adapter(status('github', 'GitHub', 'github ok'), 20),
      opendq: adapter(status('opendq', 'OpenDQ', 'opendq ok'), 5),
    });

    const digest = await service.today();
    expect(digest).toBe([
      'Today - Project Intelligence',
      'GitHub: ok - github ok',
      'OpenDQ: ok - opendq ok',
      'Dream Logs: ok - repository readable - site reachable',
    ].join('\n'));
  });

  it('keeps successful projects visible when one adapter fails', async () => {
    const service = intelligence({
      opendq: failingAdapter('database password=secret-value'),
    });

    const digest = await service.today();

    expect(digest).toContain('GitHub: ok - 3/3 repositories readable');
    expect(digest).toContain('OpenDQ: temporarily unavailable');
    expect(digest).toContain('Dream Logs: ok - repository readable - site reachable');
    expect(digest).not.toContain('secret-value');
  });

  it('renders stable unavailable lines for multiple failures', async () => {
    const service = intelligence({
      github: failingAdapter('github transport internals'),
      dreamlogs: failingAdapter('https://secret.example/private'),
    });

    const digest = await service.today();

    expect(digest).toContain('GitHub: temporarily unavailable');
    expect(digest).toContain('OpenDQ: ok - repository readable - site reachable');
    expect(digest).toContain('Dream Logs: temporarily unavailable');
    expect(digest).not.toContain('transport internals');
    expect(digest).not.toContain('secret.example');
  });

  it('renders individual project status deterministically', async () => {
    const service = intelligence();
    expect(await service.github()).toBe('GitHub: ok - 3/3 repositories readable');
    expect(await service.opendq()).toBe('OpenDQ: ok - repository readable - site reachable');
    expect(await service.dreamlogs()).toBe('Dream Logs: ok - repository readable - site reachable');
  });
});

