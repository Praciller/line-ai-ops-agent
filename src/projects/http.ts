export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type ProjectHttpRequestOptions = {
  headers?: HeadersInit;
};

export interface ProjectHttpClient {
  request(url: string, options?: ProjectHttpRequestOptions): Promise<Response>;
}

type ProjectHttpClientOptions = {
  fetchImpl?: FetchLike;
  timeoutMs: number;
  maxAttempts?: number;
};

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
export function createProjectHttpClient(options: ProjectHttpClientOptions): ProjectHttpClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxAttempts = options.maxAttempts ?? 2;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 2) {
    throw new Error('Project HTTP maxAttempts must be 1 or 2');
  }

  return {
    async request(url, requestOptions = {}) {
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const response = await fetchImpl(url, {
            method: 'GET',
            headers: requestOptions.headers,
            signal: AbortSignal.timeout(options.timeoutMs),
          });
          if (isTransientStatus(response.status) && attempt < maxAttempts) continue;
          return response;
        } catch (error) {
          lastError = error;
          if (attempt === maxAttempts) throw error;
        }
      }
      throw lastError instanceof Error ? lastError : new Error('Project HTTP request failed');
    },
  };
}
