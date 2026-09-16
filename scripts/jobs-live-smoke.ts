import { pathToFileURL } from 'node:url';

import { createJobRadarFromDefaults } from '../src/jobs/factory.js';
import type { JobRadar } from '../src/jobs/radar.js';
import { renderJobRadar } from '../src/jobs/render.js';

export async function runJobsLiveSmoke(
  radar: JobRadar = createJobRadarFromDefaults(),
): Promise<number> {
  const result = await radar.find();
  console.log(JSON.stringify(result.sources));
  console.log(renderJobRadar(result));
  return result.sources.some(
    (source) => source.outcome === 'success' || source.outcome === 'cache',
  ) ? 0 : 1;
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  process.exitCode = await runJobsLiveSmoke();
}
