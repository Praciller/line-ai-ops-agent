import { pathToFileURL } from 'node:url';

import { loadConfig } from './config.js';
import { buildHealthReport } from './health.js';
import { createLogger } from './logging.js';

type Writer = (line: string) => void;

function secretValuesFromEnv(env: NodeJS.ProcessEnv): string[] {
  return Object.entries(env)
    .filter(([key, value]) => value && /(token|secret|key|password)/i.test(key))
    .map(([, value]) => value as string);
}

export function runDryRun(env: NodeJS.ProcessEnv, write: Writer): number {
  try {
    const config = loadConfig(env);
    write(JSON.stringify(buildHealthReport(config)));
    return 0;
  } catch (error) {
    const logger = createLogger({ secrets: secretValuesFromEnv(env), write });
    const message = error instanceof Error ? error.message : 'Unknown configuration error';
    logger.error(message);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runDryRun(process.env, (line) => process.stdout.write(`${line}\n`));
}
