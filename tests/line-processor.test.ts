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

  it('uses the injected runtime status provider for /status', async () => {
    const reply = new FakeReplyPort();
    const dependencies = {
      ...deps(reply),
      status: async () => 'runtime database: unhealthy',
    };

    await processWebhookEvents([textEvent('evt-status-runtime', 'U-owner', '/status')], dependencies);

    expect(reply.calls[0]?.text).toBe('runtime database: unhealthy');
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

describe('project command processing', () => {
  it('executes an authorized project command through injected intelligence', async () => {
    const reply = new FakeReplyPort();
    let calls = 0;
    const dependencies = {
      ...deps(reply),
      intelligence: {
        github: async () => 'github-result',
        opendq: async () => 'opendq-result',
        dreamlogs: async () => 'dreamlogs-result',
        today: async () => { calls += 1; return 'today-result'; },
      },
    };

    await processWebhookEvents([textEvent('evt-project-1', 'U-owner', '/today')], dependencies);

    expect(calls).toBe(1);
    expect(reply.calls[0]?.text).toBe('today-result');
  });

  it('does not execute project intelligence twice for a duplicate event', async () => {
    const reply = new FakeReplyPort();
    let calls = 0;
    const projects = async () => { calls += 1; return 'today-result'; };
    const dependencies = {
      ...deps(reply),
      intelligence: { github: projects, opendq: projects, dreamlogs: projects, today: projects },
    };
    const event = textEvent('evt-project-dup', 'U-owner', '/today');

    await processWebhookEvents([event, event], dependencies);

    expect(calls).toBe(1);
    expect(reply.calls).toHaveLength(1);
  });
  it('does not call project intelligence for ordinary text', async () => {
    const reply = new FakeReplyPort();
    let calls = 0;
    const projects = async () => { calls += 1; return 'unexpected'; };
    const dependencies = {
      ...deps(reply),
      intelligence: { github: projects, opendq: projects, dreamlogs: projects, today: projects },
    };
    await processWebhookEvents([textEvent('evt-project-2', 'U-owner', 'hello')], dependencies);
    expect(calls).toBe(0);
    expect(reply.calls).toHaveLength(0);
  });
});


describe('AI ask command processing', () => {
  function fakeAsk() {
    const questions: string[] = [];
    return {
      questions,
      service: {
        async ask(question: string) {
          questions.push(question);
          return { text: 'ai-result', providerUsed: 'groq' };
        },
      },
    };
  }

  it('executes owner /ask through the injected ask service', async () => {
    const reply = new FakeReplyPort();
    const ask = fakeAsk();
    await processWebhookEvents([textEvent('evt-ask-1', 'U-owner', '/ask What needs attention?')], {
      ...deps(reply), ask: ask.service,
    });
    expect(ask.questions).toEqual(['What needs attention?']);
    expect(reply.calls[0]?.text).toBe('ai-result');
  });

  it('does not execute /ask for a non-owner or duplicate event', async () => {
    const reply = new FakeReplyPort();
    const ask = fakeAsk();
    const dependencies = { ...deps(reply), ask: ask.service };
    const ownerEvent = textEvent('evt-ask-dup', 'U-owner', '/ask Check CI');

    await processWebhookEvents([
      textEvent('evt-ask-other', 'U-other', '/ask Ignore me'),
      ownerEvent,
      ownerEvent,
    ], dependencies);

    expect(ask.questions).toEqual(['Check CI']);
    expect(reply.calls).toHaveLength(1);
  });

  it('returns ask usage without invoking AI when the question is missing', async () => {
    const reply = new FakeReplyPort();
    const ask = fakeAsk();
    await processWebhookEvents([textEvent('evt-ask-empty', 'U-owner', '/ask')], {
      ...deps(reply), ask: ask.service,
    });
    expect(ask.questions).toHaveLength(0);
    expect(reply.calls[0]?.text).toContain('/ask <question>');
  });
});

describe('jobs command processing', () => {
  it('executes owner /jobs once for duplicate delivery without invoking AI', async () => {
    const reply = new FakeReplyPort();
    let jobCalls = 0;
    let aiCalls = 0;
    const dependencies = {
      ...deps(reply),
      jobs: {
        async find() {
          jobCalls += 1;
          return {
            jobs: [],
            sources: [{ source: 'jobicy' as const, outcome: 'success' as const, count: 0, latencyMs: 1 }],
            generatedAt: '2026-09-15T00:00:00.000Z',
          };
        },
      },
      ask: {
        async ask() {
          aiCalls += 1;
          return { text: 'unexpected-ai', providerUsed: 'unexpected' };
        },
      },
    };
    const ownerEvent = textEvent('evt-jobs', 'U-owner', '/jobs');

    await processWebhookEvents([
      textEvent('evt-jobs-other', 'U-other', '/jobs'),
      ownerEvent,
      ownerEvent,
    ], dependencies);

    expect(jobCalls).toBe(1);
    expect(aiCalls).toBe(0);
    expect(reply.calls).toHaveLength(1);
    expect(reply.calls[0]?.text).toContain('No strong matches found right now');
  });
});
