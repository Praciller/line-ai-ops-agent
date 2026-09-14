import type { FetchLike } from './types.js';

export async function fetchJson(
  url: URL,
  allowedHost: string,
  fetchFn: FetchLike,
  signal?: AbortSignal,
): Promise<unknown> {
  if (url.protocol !== 'https:' || url.hostname !== allowedHost) {
    throw new Error('JobSourceHostError');
  }

  const response = await fetchFn(url, {
    method: 'GET',
    signal,
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(response.status === 429 ? 'JobSourceRateLimitError' : 'JobSourceHttpError');
  }

  return response.json();
}
