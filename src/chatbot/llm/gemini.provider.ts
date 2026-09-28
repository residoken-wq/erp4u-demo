import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import {
  LlmProvider,
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmInvalidOutputError,
  LlmRateLimitError,
  LlmUnavailableError,
} from './llm-provider';
import { ChatbotConfigService } from '../config/chatbot-config.service';

export function resolveGeminiKey(): { key: string; source: 'CHATBOT_LLM_API_KEY' | 'GEMINI_API_KEY' | 'none' } {
  if (process.env.CHATBOT_LLM_API_KEY) {
    return { key: process.env.CHATBOT_LLM_API_KEY, source: 'CHATBOT_LLM_API_KEY' };
  }
  if (process.env.GEMINI_API_KEY) {
    return { key: process.env.GEMINI_API_KEY, source: 'GEMINI_API_KEY' };
  }
  return { key: '', source: 'none' };
}

@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini' as const;
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly apiKey: string;
  private readonly configuredModel: string;
  private readonly fetchFn: typeof fetch;

  private cachedBestModel: { model: string; expiresAt: number } | null = null;
  private blacklistedModels = new Set<string>();

  // In-RAM circuit breaker
  private circuitOpenUntil = 0;
  private lastFailureType: 'rate_limited' | 'unavailable' | null = null;
  private lastRetryAfterS = 0;

  private readonly configService?: ChatbotConfigService;

  constructor(
    @Optional() arg1?: ChatbotConfigService | string,
    @Optional() @Inject('GEMINI_API_KEY') arg2?: string,
    @Optional() @Inject('GEMINI_MODEL') arg3?: string | typeof fetch,
    @Optional() @Inject('GEMINI_FETCH') arg4?: typeof fetch | ChatbotConfigService,
  ) {
    const resolved = resolveGeminiKey();
    if (typeof arg1 === 'string') {
      this.apiKey = arg1 || resolved.key;
      this.configuredModel = typeof arg2 === 'string' ? arg2 : (process.env.CHATBOT_LLM_MODEL || '');
      this.fetchFn = typeof arg3 === 'function' ? arg3 : globalThis.fetch;
      this.configService = arg4 && 'get' in arg4 ? (arg4 as ChatbotConfigService) : undefined;
    } else {
      this.configService = arg1;
      this.apiKey = typeof arg2 === 'string' ? arg2 : resolved.key;
      this.configuredModel = typeof arg3 === 'string' ? arg3 : (process.env.CHATBOT_LLM_MODEL || '');
      this.fetchFn = typeof arg4 === 'function' ? arg4 : globalThis.fetch;
    }
  }

  async getModel(): Promise<string> {
    // 1. Env CHATBOT_LLM_MODEL
    const envModel = process.env.CHATBOT_LLM_MODEL || this.configuredModel;
    if (envModel && !this.blacklistedModels.has(envModel)) {
      return envModel;
    }

    // 2. Model in system config
    if (this.configService) {
      try {
        const cfg = await this.configService.get();
        if (cfg.llm?.model && !this.blacklistedModels.has(cfg.llm.model)) {
          return cfg.llm.model;
        }
      } catch (e: any) {
        this.logger.debug(`Could not read llm.model from configService: ${e?.message}`);
      }
    }

    // 3. Cached dynamic model
    const now = Date.now();
    if (this.cachedBestModel && now < this.cachedBestModel.expiresAt && !this.blacklistedModels.has(this.cachedBestModel.model)) {
      return this.cachedBestModel.model;
    }

    // 4. Dynamic selection from Google API
    let selected = 'models/gemini-1.5-flash';
    if (this.apiKey) {
      try {
        const listUrl = `https://generativelanguage.googleapis.com/v1/models`;
        const res = await this.fetchFn(listUrl, {
          headers: { 'x-goog-api-key': this.apiKey },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.models)) {
            // Filter: generateContent supported, name contains flash, not blacklisted
            let candidates = data.models.filter(
              (m: any) =>
                m.supportedGenerationMethods?.includes('generateContent') &&
                m.name?.includes('flash') &&
                !this.blacklistedModels.has(m.name),
            );

            // Bỏ -lite/-exp/preview nếu có bản thường
            const standardCandidates = candidates.filter(
              (m: any) => !/-lite|-exp|preview/i.test(m.name),
            );
            if (standardCandidates.length > 0) {
              candidates = standardCandidates;
            }

            // Parse version number and sort descending
            const getVersion = (name: string): number => {
              const match = name.match(/gemini-(\d+(?:\.\d+)?)-flash/i);
              return match ? parseFloat(match[1]) : 0;
            };

            candidates.sort((a: any, b: any) => {
              const vA = getVersion(a.name);
              const vB = getVersion(b.name);
              if (vB !== vA) return vB - vA;
              return a.name.localeCompare(b.name);
            });

            if (candidates[0]?.name) {
              selected = candidates[0].name;
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Could not list Gemini models: ${err?.message}, using fallback`);
      }
    }

    this.cachedBestModel = {
      model: selected,
      expiresAt: now + 24 * 60 * 60 * 1000,
    };
    return selected;
  }

  async generateJson<T>(req: LlmGenerateRequest): Promise<LlmGenerateResult<T>> {
    const startTime = Date.now();

    // Check circuit breaker first
    if (Date.now() < this.circuitOpenUntil) {
      const remainingS = Math.ceil((this.circuitOpenUntil - Date.now()) / 1000);
      if (this.lastFailureType === 'rate_limited') {
        throw new LlmRateLimitError(
          `Gemini rate limit circuit breaker active (${remainingS}s remaining)`,
          remainingS,
        );
      } else {
        throw new LlmUnavailableError(
          `Gemini unavailable circuit breaker active (${remainingS}s remaining)`,
          remainingS,
        );
      }
    }

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

    // Try up to 3 model selections in case of 404 (model retired/no longer available)
    let lastError: Error | null = null;
    for (let modelAttempt = 0; modelAttempt < 3; modelAttempt++) {
      const model = await this.getModel();
      const cleanModel = model.startsWith('models/') ? model.slice(7) : model;
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent`;

      const executeCall = async (retryAttempt: number): Promise<Response> => {
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

          if ((response.status === 429 || response.status >= 500) && retryAttempt === 0) {
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
          if (retryAttempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return executeCall(1);
          }
          throw err;
        }
      };

      const res = await executeCall(0);

      // Handle 404: model retired / not found -> blacklist and pick next candidate
      if (res.status === 404) {
        this.logger.warn(`Gemini model ${model} returned 404, blacklisting and selecting next candidate`);
        this.blacklistedModels.add(model);
        this.cachedBestModel = null;
        lastError = new Error(`Gemini model ${model} returned 404`);
        continue;
      }

      // Handle 429: Rate limited -> circuit breaker in RAM
      if (res.status === 429) {
        const errText = await res.text().catch(() => '');
        let retryAfterS = 60;
        const delayMatch = errText.match(/retryDelay"?\s*:\s*"?(\d+)/i);
        if (delayMatch) {
          retryAfterS = parseInt(delayMatch[1], 10);
        } else if (res.headers && typeof res.headers.get === 'function') {
          const hdr = res.headers.get('retry-after');
          if (hdr) retryAfterS = parseInt(hdr, 10) || 60;
        }
        this.circuitOpenUntil = Date.now() + retryAfterS * 1000;
        this.lastFailureType = 'rate_limited';
        this.lastRetryAfterS = retryAfterS;
        this.logger.warn(`Gemini rate limited (429). Circuit open for ${retryAfterS}s`);
        throw new LlmRateLimitError(`Gemini API rate limit exceeded: ${errText}`, retryAfterS);
      }

      // Handle 503: Service Unavailable -> circuit breaker in RAM
      if (res.status === 503) {
        const errText = await res.text().catch(() => '');
        const retryAfterS = 30;
        this.circuitOpenUntil = Date.now() + retryAfterS * 1000;
        this.lastFailureType = 'unavailable';
        this.lastRetryAfterS = retryAfterS;
        this.logger.warn(`Gemini unavailable (503). Circuit open for ${retryAfterS}s`);
        throw new LlmUnavailableError(`Gemini API service unavailable: ${errText}`, retryAfterS);
      }

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
        model,
        latencyMs,
        usage: usageMetadata
          ? {
              input: usageMetadata.promptTokenCount,
              output: usageMetadata.candidatesTokenCount,
            }
          : undefined,
      };
    }

    throw lastError || new Error('Gemini API failed after model selection retries');
  }
}
