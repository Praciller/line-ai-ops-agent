import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createLogger } from './logging.js';

const config = loadConfig(process.env);
const logger = createLogger();
const app = createApp(config);

app.listen(config.port, () => {
  logger.info('service started', {
    service: config.serviceName,
    port: config.port,
    mode: 'dry-run',
  });
});
