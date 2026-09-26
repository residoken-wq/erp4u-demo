export class LlmInvalidOutputError extends Error {
  constructor(message = 'LLM returned invalid output or failed schema validation') {
    super(message);
    this.name = 'LlmInvalidOutputError';
  }
}

export interface LlmGenerateRequest {
  system: string;
  messages: { role: 'user' | 'model'; text: string }[];
  schemaName: string;
  jsonSchema: object;
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
  generateJson<T>(req: LlmGenerateRequest): Promise<LlmGenerateResult<T>>;
}

export const LLM_PROVIDER = 'LLM_PROVIDER';
