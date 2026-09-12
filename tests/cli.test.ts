import { describe, expect, it } from 'vitest';

import { runDryRun } from '../src/cli.js';

describe('runDryRun', () => {
  it('prints a health report without external calls', () => {
    const lines: string[] = [];

    const exitCode = runDryRun({ NODE_ENV: 'test' }, (line) => lines.push(line));

    expect(exitCode).toBe(0);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      service: 'personal-ai-ops-line',
      status: 'ok',
      mode: 'dry-run',
    });
  });

  it('fails closed on a paid model without leaking secrets', () => {
    const lines: string[] = [];
    const secret = 'secret-api-key-123';

    const exitCode = runDryRun(
      { OPENROUTER_MODEL: 'anthropic/claude-sonnet-4', OPENROUTER_API_KEY: secret },
      (line) => lines.push(line),
    );

    expect(exitCode).toBe(1);
    expect(lines.join('\n')).toMatch(/free-only/i);
    expect(lines.join('\n')).not.toContain(secret);
  });
});
