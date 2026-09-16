import { createHimalayasAdapter } from './adapters/himalayas.js';
import { createJobicyAdapter } from './adapters/jobicy.js';
import { createRemoteOkAdapter } from './adapters/remoteok.js';
import type { FetchLike } from './adapters/types.js';
import { createJobRadar, type JobRadar } from './radar.js';

const defaultFetch: FetchLike = (input, init) => fetch(input, init);

export function createJobRadarFromDefaults(
  fetchFn: FetchLike = defaultFetch,
): JobRadar {
  return createJobRadar([
    createJobicyAdapter(fetchFn),
    createHimalayasAdapter(fetchFn),
    createRemoteOkAdapter(fetchFn),
  ]);
}
