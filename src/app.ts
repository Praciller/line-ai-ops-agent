import express, { type Express } from 'express';

import type { AppConfig } from './config.js';
import { buildHealthReport } from './health.js';

export function createApp(config: AppConfig): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_request, response) => {
    response.status(200).json(buildHealthReport(config));
  });

  return app;
}
