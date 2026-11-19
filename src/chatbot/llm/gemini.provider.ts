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
import { UsageService } from '../../common/packages/usage.service';
import { TenantConfigService } from '../../common/tenancy/tenant-config.service';
import {
  DEFAULT_TENANT_CONTEXT,
  TenantContext,
} from '../../common/tenancy/tenant-context';

export function resolveGeminiKey(): {
  key: string;
  source: 'CHATBOT_LLM_API_KEY' | 'GEMINI_API_KEY' | 'none';
} {
  if (TenantContext.current().tenantId !== DEFAULT_TENANT_CONTEXT.tenantId) {
    return { key: '', source: 'none' };
  }
  if (process.env.CHATBOT_LLM_API_KEY) {
    return {
      key: process.env.CHATBOT_LLM_API_KEY,
      source: 'CHATBOT_LLM_API_KEY',
    };
  }
  if (process.env.GEMINI_API_KEY) {
    return { key: process.env.GEMINI_API_KEY, source: 'GEMINI_API_KEY' };
  }
  return { key: '', source: 'none' };
}

export async function resolveTenantGeminiKey(
  tenantConfigService?: TenantConfigService,
): Promise<{
  key: string;
  source: 'CHATBOT_LLM_API_KEY' | 'GEMINI_API_KEY' | 'none';
}> {
  if (!tenantConfigService) {
    return resolveGeminiKey();
  }
  const vals = await tenantConfigService.getMany([
    'CHATBOT_LLM_API_KEY',
    'GEMINI_API_KEY',
  ]);
  if (vals['CHATBOT_LLM_API_KEY']) {
    return {
      key: vals['CHATBOT_LLM_API_KEY'],
      source: 'CHATBOT_LLM_API_KEY',
    };
  }
  if (vals['GEMINI_API_KEY']) {
    return { key: vals['GEMINI_API_KEY'], source: 'GEMINI_API_KEY' };
  }
  return { key: '', source: 'none' };
}

interface TenantGeminiState {
  cachedBestModel: { model: string; expiresAt: number } | null;
  blacklistedModels: Set<string>;
  circuitOpenUntil: number;
  lastFailureType: 'rate_limited' | 'unavailable' | null;
  lastRetryAfterS: number;
}

@Injectable()
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini' as const;
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly explicitApiKey: string;
  private readonly explicitModel: string;
  private readonly fetchFn: typeof fetch;

  private readonly stateByTenant = new Map<string, TenantGeminiState>();

  private readonly configService?: ChatbotConfigService;
  private readonly usageService?: UsageService;
  private readonly tenantConfigService?: TenantConfigService;

  constructor(
    @Optional() arg1?: ChatbotConfigService | string,
    @Optional() @Inject('GEMINI_API_KEY') arg2?: string,
    @Optional() @Inject('GEMINI_MODEL') arg3?: string | typeof fetch,
    @Optional()
    @Inject('GEMINI_FETCH')
    arg4?: typeof fetch | ChatbotConfigService,
    @Optional() usageService?: UsageService,
    @Optional() tenantConfigService?: TenantConfigService,
  ) {
    if (typeof arg1 === 'string') {
      this.explicitApiKey = arg1;
      this.explicitModel = typeof arg2 === 'string' ? arg2 : '';
      this.fetchFn = typeof arg3 === 'function' ? arg3 : globalThis.fetch;
      this.configService =
        arg4 && 'get' in arg4 ? (arg4 as ChatbotConfigService) : undefined;
    } else {
      this.configService = arg1;
      this.explicitApiKey = typeof arg2 === 'string' ? arg2 : '';
      this.explicitModel = typeof arg3 === 'string' ? arg3 : '';
      this.fetchFn = typeof arg4 === 'function' ? arg4 : globalThis.fetch;
    }
    this.usageService = usageService;
    this.tenantConfigService = tenantConfigService;
  }

  private getTenantState(): TenantGeminiState {
    const tenantId = TenantContext.current().tenantId;
    let state = this.stateByTenant.get(tenantId);
    if (!state) {
      state = {
        cachedBestModel: null,
        blacklistedModels: new Set<string>(),
        circuitOpenUntil: 0,
        lastFailureType: null,
        lastRetryAfterS: 0,
      };
      this.stateByTenant.set(tenantId, state);
    }
    return state;
  }

  private async resolveApiKey(): Promise<string> {
    if (this.explicitApiKey) {
      return this.explicitApiKey;
    }
    const resolved = await resolveTenantGeminiKey(this.tenantConfigService);
    return resolved.key;
  }

  private async resolveConfiguredModel(): Promise<string> {
    if (this.explicitModel) {
      return this.explicitModel;
    }
    if (this.tenantConfigService) {
      return (await this.tenantConfigService.get('CHATBOT_LLM_MODEL')) || '';
    }
    if (TenantContext.current().tenantId === DEFAULT_TENANT_CONTEXT.tenantId) {
      return process.env.CHATBOT_LLM_MODEL || '';
    }
    return '';
  }

  async getModel(): Promise<string> {
    const state = this.getTenantState();

    // 1. Tenant config / default-tenant env CHATBOT_LLM_MODEL or explicit override
    const configuredModel = await this.resolveConfiguredModel();
    if (configuredModel && !state.blacklistedModels.has(configuredModel)) {
      return configuredModel;
    }

    // 2. Model in chatbot system config
    if (this.configService) {
      try {
        const cfg = await this.configService.get();
        if (cfg.llm?.model && !state.blacklistedModels.has(cfg.llm.model)) {
          return cfg.llm.model;
        }
      } catch (e: any) {
        this.logger.debug(
          `Could not read llm.model from configService: ${e?.message}`,
        );
      }
    }

    // 3. Cached dynamic model (per tenant)
    const now = Date.now();
    if (
      state.cachedBestModel &&
      now < state.cachedBestModel.expiresAt &&
      !state.blacklistedModels.has(state.cachedBestModel.model)
    ) {
      return state.cachedBestModel.model;
    }

    // 4. Dynamic selection from Google API
    let selected = 'models/gemini-1.5-flash';
    const apiKey = await this.resolveApiKey();
    if (apiKey) {
      try {
        const listUrl = `https://generativelanguage.googleapis.com/v1/models`;
        const res = await this.fetchFn(listUrl, {
          headers: { 'x-goog-api-key': apiKey },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.models)) {
            let candidates = data.models.filter(
              (m: any) =>
                m.supportedGenerationMethods?.includes('generateContent') &&
                m.name?.includes('flash') &&
                !state.blacklistedModels.has(m.name),
            );

            const standardCandidates = candidates.filter(
              (m: any) => !/-lite|-exp|preview/i.test(m.name),
            );
            if (standardCandidates.length > 0) {
              candidates = standardCandidates;
            }

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
        this.logger.warn(
          `Could not list Gemini models: ${err?.message}, using fallback`,
        );
      }
    }

    state.cachedBestModel = {
      model: selected,
      expiresAt: now + 24 * 60 * 60 * 1000,
    };
    return selected;
  }

  async generateJson<T>(
    req: LlmGenerateRequest,
  ): Promise<LlmGenerateResult<T>> {
    const startTime = Date.now();
    const state = this.getTenantState();
    const apiKey = await this.resolveApiKey();

    if (!apiKey) {
      throw new LlmUnavailableError(
        `Gemini API key is not configured for tenant "${TenantContext.current().tenantId}"`,
        0,
      );
    }

    // Check circuit breaker first (scoped per tenant)
    if (Date.now() < state.circuitOpenUntil) {
      const remainingS = Math.ceil((state.circuitOpenUntil - Date.now()) / 1000);
      if (state.lastFailureType === 'rate_limited') {
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
        const timeoutTimer = setTimeout(
          () => controller.abort(),
          req.timeoutMs || 20000,
        );

        try {
          const response = await this.fetchFn(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          clearTimeout(timeoutTimer);

          if (
            (response.status === 429 || response.status >= 500) &&
            retryAttempt === 0
          ) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return executeCall(1);
          }

          return response;
        } catch (err: any) {
          clearTimeout(timeoutTimer);
          if (err.name === 'AbortError' || controller.signal.aborted) {
            const timeoutErr = new Error(
              `LLM request timed out after ${req.timeoutMs}ms`,
            );
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

      if (res.status === 404) {
        this.logger.warn(
          `Gemini model ${model} returned 404, blacklisting and selecting next candidate`,
        );
        state.blacklistedModels.add(model);
        state.cachedBestModel = null;
        lastError = new Error(`Gemini model ${model} returned 404`);
        continue;
      }

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
        state.circuitOpenUntil = Date.now() + retryAfterS * 1000;
        state.lastFailureType = 'rate_limited';
        state.lastRetryAfterS = retryAfterS;
        this.logger.warn(
          `Gemini rate limited (429). Circuit open for ${retryAfterS}s`,
        );
        throw new LlmRateLimitError(
          `Gemini API rate limit exceeded: ${errText}`,
          retryAfterS,
        );
      }

      if (res.status === 503) {
        const errText = await res.text().catch(() => '');
        const retryAfterS = 30;
        state.circuitOpenUntil = Date.now() + retryAfterS * 1000;
        state.lastFailureType = 'unavailable';
        state.lastRetryAfterS = retryAfterS;
        this.logger.warn(
          `Gemini unavailable (503). Circuit open for ${retryAfterS}s`,
        );
        throw new LlmUnavailableError(
          `Gemini API service unavailable: ${errText}`,
          retryAfterS,
        );
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
        throw new LlmInvalidOutputError(
          'Gemini response could not be parsed as JSON',
        );
      }

      const candidate = jsonResponse.candidates?.[0];
      const textPart = candidate?.content?.parts?.[0]?.text;
      if (!textPart) {
        throw new LlmInvalidOutputError(
          'Gemini returned empty or missing content candidate',
        );
      }

      let parsedData: T;
      try {
        parsedData = JSON.parse(textPart);
      } catch {
        throw new LlmInvalidOutputError(
          'Gemini candidate text could not be parsed as JSON',
        );
      }

      const latencyMs = Date.now() - startTime;
      const usageMetadata = jsonResponse.usageMetadata;

      await this.usageService?.increment('ai_calls');

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
