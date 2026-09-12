import {
  JSONParseError,
  SignatureValidationFailed,
  middleware as lineMiddleware,
  type webhook,
} from '@line/bot-sdk';
import express, { type Express, type Request, type Response } from 'express';

import type { AppConfig } from './config.js';
import { buildHealthReport } from './health.js';
import { InMemoryEventDeduper, type EventDeduper } from './line/dedupe.js';
import { processWebhookEvents } from './line/processor.js';
import { createLineSdkReplyClient, type LineReplyPort } from './line/reply.js';
import { createProjectIntelligenceFromConfig } from './projects/factory.js';
import type { ProjectIntelligence } from './projects/intelligence.js';

type AppOptions = {
  deduper?: EventDeduper;
  reply?: LineReplyPort;
  intelligence?: ProjectIntelligence;
};

type WebhookBody = {
  events: webhook.Event[];
};

function parseWebhookBody(value: unknown): WebhookBody | null {
  if (!value || typeof value !== 'object') return null;
  const events = (value as { events?: unknown }).events;
  return Array.isArray(events) ? { events: events as webhook.Event[] } : null;
}

export function createApp(config: AppConfig, options: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_request, response) => {
    response.status(200).json(buildHealthReport(config));
  });

  if (!config.line) {
    app.post('/webhook', (_request, response) => {
      response.status(503).json({ error: 'line_not_configured' });
    });
    return app;
  }

  const deduper = options.deduper ?? new InMemoryEventDeduper();
  const reply = options.reply ?? createLineSdkReplyClient(config.line.channelAccessToken);
  const intelligence = options.intelligence ??
    createProjectIntelligenceFromConfig(config.projects);

  app.post(
    '/webhook',
    lineMiddleware({ channelSecret: config.line.channelSecret }),
    async (request: Request, response: Response, next) => {
      try {
        const body = parseWebhookBody(request.body);
        if (!body) {
          response.status(400).json({ error: 'invalid_webhook_body' });
          return;
        }

        await processWebhookEvents(body.events, {
          config,
          deduper,
          reply,
          intelligence,
        });
        response.status(200).json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );

  app.use((error: unknown, _request: Request, response: Response, _next: unknown) => {
    if (error instanceof SignatureValidationFailed) {
      response.status(401).json({ error: 'invalid_signature' });
      return;
    }
    if (error instanceof JSONParseError) {
      response.status(400).json({ error: 'invalid_json' });
      return;
    }
    response.status(500).json({ error: 'webhook_processing_failed' });
  });

  return app;
}
