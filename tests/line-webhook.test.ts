import { createHmac } from 'node:crypto';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { LineReplyPort } from '../src/line/reply.js';

const secret = 'channel-secret';

class FakeReplyPort implements LineReplyPort {
  readonly calls: Array<{ replyToken: string; text: string }> = [];

  async reply(replyToken: string, text: string): Promise<void> {
    this.calls.push({ replyToken, text });
  }
}

function configuredApp(reply = new FakeReplyPort()) {
  const config = loadConfig({
    NODE_ENV: 'test',
    LINE_CHANNEL_SECRET: secret,
    LINE_CHANNEL_ACCESS_TOKEN: 'access-token',
    LINE_OWNER_USER_IDS: 'U-owner',
  });
  return { app: createApp(config, { reply }), reply };
}

function sign(body: string): string {
  return createHmac('sha256', secret).update(body).digest('base64');
}
describe('POST /webhook', () => {
  it('returns 503 when LINE configuration is absent', async () => {
    const app = createApp(loadConfig({ NODE_ENV: 'test' }));

    const response = await request(app).post('/webhook').send('{}');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'line_not_configured' });
  });

  it('rejects a missing signature before processing', async () => {
    const { app, reply } = configuredApp();

    const response = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .send('{"events":[]}');

    expect(response.status).toBe(401);
    expect(reply.calls).toHaveLength(0);
  });

  it('rejects an invalid signature before processing', async () => {
    const { app, reply } = configuredApp();

    const response = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('x-line-signature', 'invalid')
      .send('{"events":[]}');

    expect(response.status).toBe(401);
    expect(reply.calls).toHaveLength(0);
  });

  it('returns 400 for signed invalid JSON', async () => {
    const { app } = configuredApp();
    const body = '{invalid-json';

    const response = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('x-line-signature', sign(body))
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'invalid_json' });
  });

  it('accepts a signed empty verification webhook', async () => {
    const { app, reply } = configuredApp();
    const body = JSON.stringify({ destination: 'U-bot', events: [] });

    const response = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('x-line-signature', sign(body))
      .send(body);

    expect(response.status).toBe(200);
    expect(reply.calls).toHaveLength(0);
  });

  it('processes a signed authorized owner command', async () => {
    const { app, reply } = configuredApp();
    const body = JSON.stringify({
      destination: 'U-bot',
      events: [{
        type: 'message', mode: 'active', timestamp: 1,
        webhookEventId: 'evt-webhook-1', deliveryContext: { isRedelivery: false },
        source: { type: 'user', userId: 'U-owner' },
        replyToken: 'reply-token',
        message: { id: 'msg-1', type: 'text', text: '/help' },
      }],
    });

    const response = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .set('x-line-signature', sign(body))
      .send(body);

    expect(response.status).toBe(200);
    expect(reply.calls).toHaveLength(1);
    expect(reply.calls[0]?.replyToken).toBe('reply-token');
  });
});

it('processes a signed project command through injected intelligence', async () => {
  const reply = new FakeReplyPort();
  const config = loadConfig({
    NODE_ENV: 'test',
    LINE_CHANNEL_SECRET: secret,
    LINE_CHANNEL_ACCESS_TOKEN: 'access-token',
    LINE_OWNER_USER_IDS: 'U-owner',
  });
  const options = {
    reply,
    intelligence: {
      github: async () => 'github-result',
      opendq: async () => 'opendq-result',
      dreamlogs: async () => 'dreamlogs-result',
      today: async () => 'today-result',
    },
  };
  const app = createApp(config, options);
  const body = JSON.stringify({
    destination: 'U-bot',
    events: [{
      type: 'message', mode: 'active', timestamp: 1,
      webhookEventId: 'evt-webhook-project', deliveryContext: { isRedelivery: false },
      source: { type: 'user', userId: 'U-owner' },
      replyToken: 'reply-project',
      message: { id: 'msg-project', type: 'text', text: '/github' },
    }],
  });
  const response = await request(app)
    .post('/webhook')
    .set('Content-Type', 'application/json')
    .set('x-line-signature', sign(body))
    .send(body);

  expect(response.status).toBe(200);
  expect(reply.calls).toHaveLength(1);
  expect(reply.calls[0]?.text).toBe('github-result');
});
