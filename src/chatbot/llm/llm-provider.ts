export class LlmInvalidOutputError extends Error {
  constructor(message = 'LLM returned invalid output or failed schema validation') {
    super(message);
    this.name = 'LlmInvalidOutputError';
  }
}

export class LlmRateLimitError extends Error {
  readonly retryAfterS: number;
  constructor(message = 'LLM rate limit reached (HTTP 429)', retryAfterS = 60) {
    super(message);
    this.name = 'LlmRateLimitError';
    this.retryAfterS = retryAfterS;
  }
}

export class LlmUnavailableError extends Error {
  readonly retryAfterS: number;
  constructor(message = 'LLM service unavailable (HTTP 503)', retryAfterS = 30) {
    super(message);
    this.name = 'LlmUnavailableError';
    this.retryAfterS = retryAfterS;
  }
}

export interface LlmGenerateRequest {
  system?: string;
  messages: { role: 'user' | 'model'; text: string }[];
  schemaName: string;
  jsonSchema?: object;
  timeoutMs: number;
}

export interface LlmGenerateResult<T> {
  data: T;
  model: string;
  latencyMs: number;
  usage?: { input?: number; output?: number };
}

export interface LlmProvider {
  readonly name: 'gemini' | 'fake';
  getModel(): Promise<string>;
  generateJson<T>(req: LlmGenerateRequest): Promise<LlmGenerateResult<T>>;
}

export const LLM_PROVIDER = 'LLM_PROVIDER';

