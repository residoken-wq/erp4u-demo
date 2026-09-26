import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import {
  LlmProvider,
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmInvalidOutputError,
} from './llm-provider';

@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini' as const;
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetchFn: typeof fetch;

  constructor(
    @Optional() @Inject('GEMINI_API_KEY') apiKey?: string,
    @Optional() @Inject('GEMINI_MODEL') model?: string,
    @Optional() @Inject('GEMINI_FETCH') fetchFn?: typeof fetch,
  ) {
    this.apiKey = apiKey || process.env.CHATBOT_LLM_API_KEY || '';
    this.model = model || process.env.CHATBOT_LLM_MODEL || 'gemini-1.5-flash';
    this.fetchFn = fetchFn || globalThis.fetch;
  }

  async generateJson<T>(req: LlmGenerateRequest): Promise<LlmGenerateResult<T>> {
    const startTime = Date.now();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;

    const payload: any = {
      contents: req.messages.map((m) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }],
      })),
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: req.jsonSchema,
      },
    };

    if (req.system) {
      payload.systemInstruction = {
        parts: [{ text: req.system }],
      };
    }

    const executeCall = async (attempt: number): Promise<Response> => {
      const controller = new AbortController();
      const timeoutTimer = setTimeout(() => controller.abort(), req.timeoutMs || 20000);

      try {
        const response = await this.fetchFn(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutTimer);

        if ((response.status === 429 || response.status >= 500) && attempt === 0) {
          // Retry once after 1 second backoff
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return executeCall(1);
        }

        return response;
      } catch (err: any) {
        clearTimeout(timeoutTimer);
        if (err.name === 'AbortError' || controller.signal.aborted) {
          const timeoutErr = new Error(`LLM request timed out after ${req.timeoutMs}ms`);
          timeoutErr.name = 'TimeoutError';
          throw timeoutErr;
        }
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return executeCall(1);
        }
        throw err;
      }
    };

    const res = await executeCall(0);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      this.logger.error(`Gemini request failed with HTTP ${res.status}`);
      throw new Error(`Gemini API error (HTTP ${res.status}): ${errText}`);
    }

    let jsonResponse: any;
    try {
      jsonResponse = await res.json();
    } catch {
      throw new LlmInvalidOutputError('Gemini response could not be parsed as JSON');
    }

    const candidate = jsonResponse.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text;
    if (!textPart) {
      throw new LlmInvalidOutputError('Gemini returned empty or missing content candidate');
    }

    let parsedData: T;
    try {
      parsedData = JSON.parse(textPart);
    } catch {
      throw new LlmInvalidOutputError('Gemini candidate text could not be parsed as JSON');
    }

    const latencyMs = Date.now() - startTime;
    const usageMetadata = jsonResponse.usageMetadata;

    return {
      data: parsedData,
      model: this.model,
      latencyMs,
      usage: usageMetadata
        ? {
            input: usageMetadata.promptTokenCount,
            output: usageMetadata.candidatesTokenCount,
          }
        : undefined,
    };
  }
}
