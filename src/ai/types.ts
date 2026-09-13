export type AiProviderName = 'openrouter' | 'groq';

export type AiGenerateInput = {
  question: string;
  context: string;
  maxOutputTokens: number;
};

export type AiProviderResult = {
  text: string;
  provider: AiProviderName;
  model: string;
  latencyMs: number;
};

export interface AiProvider {
  readonly name: AiProviderName;
  readonly model: string;
  generate(input: AiGenerateInput): Promise<AiProviderResult>;
}

export type AiProviderErrorCategory =
  | 'timeout'
  | 'rate_limited'
  | 'server_error'
  | 'http_error'
  | 'network_error'
  | 'invalid_response';

export class AiProviderError extends Error {
  constructor(
    readonly provider: AiProviderName,
    readonly model: string,
    readonly category: AiProviderErrorCategory,
    readonly status: number | null = null,
  ) {
    super(`${provider} provider ${category}`);
    this.name = 'AiProviderError';
  }
}
