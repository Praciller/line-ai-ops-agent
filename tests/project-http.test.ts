import { describe, expect, it } from 'vitest';

import { createProjectHttpClient, type FetchLike } from '../src/projects/http.js';

describe('createProjectHttpClient', () => {
  it('retries one transient 5xx response and returns the second response', async () => {
    let attempts = 0;
    const fetchImpl: FetchLike = async () => {
      attempts += 1;
      return attempts === 1
        ? new Response('temporary', { status: 503 })
        : new Response('{"ok":true}', { status: 200 });
    };
    const client = createProjectHttpClient({ fetchImpl, timeoutMs: 1000 });

    const response = await client.request('https://example.com/status');

    expect(response.status).toBe(200);
    expect(attempts).toBe(2);
  });

  it('does not retry a non-transient 404 response', async () => {
    let attempts = 0;    const fetchImpl: FetchLike = async () => {
      attempts += 1;
      return new Response('missing', { status: 404 });
    };
    const client = createProjectHttpClient({ fetchImpl, timeoutMs: 1000 });

    const response = await client.request('https://example.com/status');

    expect(response.status).toBe(404);
    expect(attempts).toBe(1);
  });

  it('retries one thrown network error then succeeds', async () => {
    let attempts = 0;
    const fetchImpl: FetchLike = async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError('network failed');
      return new Response('ok', { status: 200 });
    };
    const client = createProjectHttpClient({ fetchImpl, timeoutMs: 1000 });

    const response = await client.request('https://example.com/status');

    expect(response.status).toBe(200);
    expect(attempts).toBe(2);
  });
  it('passes an abort signal with the configured timeout to each attempt', async () => {
    const seenSignals: AbortSignal[] = [];
    const fetchImpl: FetchLike = async (_url, init) => {
      if (init?.signal) seenSignals.push(init.signal);
      return new Response('ok', { status: 200 });
    };
    const client = createProjectHttpClient({ fetchImpl, timeoutMs: 750 });

    await client.request('https://example.com/status');

    expect(seenSignals).toHaveLength(1);
    expect(seenSignals[0]).toBeInstanceOf(AbortSignal);
  });
});
