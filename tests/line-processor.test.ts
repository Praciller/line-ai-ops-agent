import type { webhook } from '@line/bot-sdk';
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';
import { InMemoryEventDeduper } from '../src/line/dedupe.js';
import { processWebhookEvents } from '../src/line/processor.js';
import type { LineReplyPort } from '../src/line/reply.js';

class FakeReplyPort implements LineReplyPort {
  readonly calls: Array<{ replyToken: string; text: string }> = [];
  failNext = false;

  async reply(replyToken: string, text: string): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('simulated reply failure');
    }
    this.calls.push({ replyToken, text });
  }
}

function lineConfig() {
  return loadConfig({
    NODE_ENV: 'test',
    LINE_CHANNEL_SECRET: 'channel-secret',
    LINE_CHANNEL_ACCESS_TOKEN: 'access-token',
    LINE_OWNER_USER_IDS: 'U-owner',
  });
}
function textEvent(
  eventId: string,
  userId: string,
  text: string,
  replyToken = `reply-${eventId}`,
): webhook.Event {
  return {
    type: 'message',
    mode: 'active',
    timestamp: 1,
    webhookEventId: eventId,
    deliveryContext: { isRedelivery: false },
    source: { type: 'user', userId },
    replyToken,
    message: { id: `msg-${eventId}`, type: 'text', text },
  } as webhook.Event;
}

function deps(reply: FakeReplyPort) {
  return {
    config: lineConfig(),
    deduper: new InMemoryEventDeduper(),
    reply,
  };
}

describe('processWebhookEvents', () => {
  it('replies to an authorized owner command', async () => {
    const reply = new FakeReplyPort();
    await processWebhookEvents([textEvent('evt-1', 'U-owner', '/help')], deps(reply));

    expect(reply.calls).toHaveLength(1);
    expect(reply.calls[0]?.replyToken).toBe('reply-evt-1');
    expect(reply.calls[0]?.text).toMatch(/\/status/);
  });

  it('ignores a command from a non-owner', async () => {
    const reply = new FakeReplyPort();

    await processWebhookEvents([textEvent('evt-2', 'U-other', '/help')], deps(reply));

    expect(reply.calls).toHaveLength(0);
  });

  it('executes a duplicate webhook event at most once', async () => {
    const reply = new FakeReplyPort();
    const dependencies = deps(reply);
    const event = textEvent('evt-3', 'U-owner', '/status');

    await processWebhookEvents([event, event], dependencies);

    expect(reply.calls).toHaveLength(1);
  });

  it('ignores owner text that is not a command', async () => {
    const reply = new FakeReplyPort();

    await processWebhookEvents([textEvent('evt-4', 'U-owner', 'hello')], deps(reply));
    expect(reply.calls).toHaveLength(0);
  });

  it('releases a dedupe claim when reply delivery fails', async () => {
    const reply = new FakeReplyPort();
    const dependencies = deps(reply);
    const event = textEvent('evt-5', 'U-owner', '/help');
    reply.failNext = true;

    await expect(processWebhookEvents([event], dependencies)).rejects.toThrow(
      /simulated reply failure/,
    );

    await processWebhookEvents([event], dependencies);

    expect(reply.calls).toHaveLength(1);
  });
});
