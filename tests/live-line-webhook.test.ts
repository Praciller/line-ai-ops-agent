import { describe, expect, it } from 'vitest';

import {
  createLineWebhookAdmin,
  LineWebhookAdminError,
} from '../src/live/line-webhook.js';

type Captured = { url: string; init?: RequestInit };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function admin(calls: Captured[], responses: Response[]) {
  return createLineWebhookAdmin({
    channelAccessToken: 'line-secret-token',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return responses.shift() ?? json({});
    },
  });
}

const webhookUrl = 'https://hermes-laptop.tail423f1b.ts.net/webhook';

describe('LINE webhook administration', () => {
  it('sets only the fixed official webhook endpoint with bearer auth', async () => {
    const calls: Captured[] = [];
    const client = admin(calls, [json({})]);
    await client.setEndpoint(webhookUrl);

    expect(calls[0]?.url).toBe('https://api.line.me/v2/bot/channel/webhook/endpoint');
    expect(calls[0]?.init?.method).toBe('PUT');
    expect(new Headers(calls[0]?.init?.headers).get('authorization')).toBe('Bearer line-secret-token');
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ endpoint: webhookUrl });
  });

  it('gets normalized endpoint state from the fixed official endpoint', async () => {
    const calls: Captured[] = [];
    const client = admin(calls, [json({ endpoint: webhookUrl, active: true })]);
    await expect(client.getEndpoint()).resolves.toEqual({ endpoint: webhookUrl, active: true });
    expect(calls[0]?.url).toBe('https://api.line.me/v2/bot/channel/webhook/endpoint');
    expect(calls[0]?.init?.method).toBe('GET');
  });

  it('tests the webhook through the official test endpoint', async () => {
    const calls: Captured[] = [];
    const client = admin(calls, [json({ success: true, timestamp: '2026-09-13T00:00:00Z' })]);
    await expect(client.testEndpoint(webhookUrl)).resolves.toEqual({ success: true });
    expect(calls[0]?.url).toBe('https://api.line.me/v2/bot/channel/webhook/test');
    expect(calls[0]?.init?.method).toBe('POST');
  });

  it('rejects non-HTTPS or non-webhook paths before any network call', async () => {
    const calls: Captured[] = [];
    const client = admin(calls, []);
    await expect(client.setEndpoint('http://example.com/webhook')).rejects.toThrow(/https/i);
    await expect(client.setEndpoint('https://example.com/not-webhook')).rejects.toThrow(/\/webhook/i);
    expect(calls).toHaveLength(0);
  });

  it('classifies failures without exposing tokens or upstream response bodies', async () => {
    const calls: Captured[] = [];
    const client = admin(calls, [new Response('sensitive upstream body', { status: 401 })]);
    try {
      await client.setEndpoint(webhookUrl);
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(LineWebhookAdminError);
      expect(error).toMatchObject({ status: 401, category: 'http_error' });
      expect(String(error)).not.toContain('line-secret-token');
      expect(String(error)).not.toContain('sensitive upstream body');
    }
  });
});
