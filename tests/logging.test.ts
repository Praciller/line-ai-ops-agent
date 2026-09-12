import { describe, expect, it } from 'vitest';

import { createLogger, redactSecrets } from '../src/logging.js';

describe('redactSecrets', () => {
  it('redacts configured secrets recursively', () => {
    const input = {
      token: 'secret-token',
      nested: ['prefix secret-token suffix', { value: 'safe' }],
    };

    expect(redactSecrets(input, ['secret-token'])).toEqual({
      token: '[REDACTED]',
      nested: ['prefix [REDACTED] suffix', { value: 'safe' }],
    });
  });
});

describe('createLogger', () => {
  it('writes JSON lines without configured secrets', () => {
    const lines: string[] = [];
    const logger = createLogger({ secrets: ['api-key-123'], write: (line) => lines.push(line) });

    logger.info('provider response api-key-123', { key: 'api-key-123' });

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('api-key-123');
    expect(JSON.parse(lines[0])).toMatchObject({ level: 'info', message: 'provider response [REDACTED]' });
  });
});
