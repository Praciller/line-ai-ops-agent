export type LineWebhookFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type LineWebhookState = {
  endpoint: string;
  active: boolean;
};

export class LineWebhookAdminError extends Error {
  constructor(
    readonly category: 'http_error' | 'network_error' | 'invalid_response',
    readonly status: number | null = null,
  ) {
    super(`LINE webhook administration ${category}`);
    this.name = 'LineWebhookAdminError';
  }
}

export interface LineWebhookAdmin {
  setEndpoint(endpoint: string): Promise<void>;
  getEndpoint(): Promise<LineWebhookState>;
  testEndpoint(endpoint?: string): Promise<{ success: boolean }>;
}

const endpointUrl = 'https://api.line.me/v2/bot/channel/webhook/endpoint';
const testUrl = 'https://api.line.me/v2/bot/channel/webhook/test';

function validateWebhookUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('LINE webhook endpoint must be a valid HTTPS URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('LINE webhook endpoint must use HTTPS');
  }
  if (parsed.pathname !== '/webhook' || parsed.search || parsed.hash) {
    throw new Error('LINE webhook endpoint path must be exactly /webhook');
  }
  return parsed.toString();
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new LineWebhookAdminError('invalid_response', response.status);
  }
}

function headers(token: string): HeadersInit {
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
}

export function createLineWebhookAdmin(options: {
  channelAccessToken: string;
  fetchImpl?: LineWebhookFetch;
}): LineWebhookAdmin {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request(url: string, init: RequestInit): Promise<Response> {
    try {
      const response = await fetchImpl(url, {
        ...init,
        headers: { ...headers(options.channelAccessToken), ...(init.headers ?? {}) },
        signal: init.signal ?? AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new LineWebhookAdminError('http_error', response.status);
      return response;
    } catch (error) {
      if (error instanceof LineWebhookAdminError) throw error;
      throw new LineWebhookAdminError('network_error');
    }
  }

  return {
    async setEndpoint(endpoint: string): Promise<void> {
      const validated = validateWebhookUrl(endpoint);
      await request(endpointUrl, {
        method: 'PUT',
        body: JSON.stringify({ endpoint: validated }),
      });
    },

    async getEndpoint(): Promise<LineWebhookState> {
      const response = await request(endpointUrl, { method: 'GET' });
      const body = await safeJson(response);
      if (!body || typeof body !== 'object') {
        throw new LineWebhookAdminError('invalid_response', response.status);
      }
      const endpoint = (body as { endpoint?: unknown }).endpoint;
      const active = (body as { active?: unknown }).active;
      if (typeof endpoint !== 'string' || typeof active !== 'boolean') {
        throw new LineWebhookAdminError('invalid_response', response.status);
      }
      return { endpoint, active };
    },

    async testEndpoint(endpoint?: string): Promise<{ success: boolean }> {
      const body = endpoint ? { endpoint: validateWebhookUrl(endpoint) } : {};
      const response = await request(testUrl, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const parsed = await safeJson(response);
      const success = parsed && typeof parsed === 'object'
        ? (parsed as { success?: unknown }).success
        : undefined;
      if (typeof success !== 'boolean') {
        throw new LineWebhookAdminError('invalid_response', response.status);
      }
      return { success };
    },
  };
}
