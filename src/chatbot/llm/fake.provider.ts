import { Injectable } from '@nestjs/common';
import {
  LlmProvider,
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmInvalidOutputError,
} from './llm-provider';

@Injectable()
export class FakeProvider implements LlmProvider {
  readonly name = 'fake' as const;

  async generateJson<T>(req: LlmGenerateRequest): Promise<LlmGenerateResult<T>> {
    const startTime = Date.now();
    const mode = process.env.CHATBOT_FAKE_MODE || 'ok';

    if (mode === 'timeout') {
      await new Promise((resolve) => setTimeout(resolve, Math.min(req.timeoutMs + 50, 100)));
      const err = new Error('LLM request timed out');
      err.name = 'AbortError';
      throw err;
    }

    if (mode === 'invalid_json') {
      throw new LlmInvalidOutputError('LLM response could not be parsed as valid JSON');
    }

    if (mode === 'inject') {
      const data = {
        reply: 'Dạ thông tin đã gửi tới bộ phận bán hàng, đơn giá tham khảo là 350.000đ ạ.',
        quote_estimate: 350000,
        sent: true,
      } as unknown as T;

      return {
        data,
        model: 'fake-model',
        latencyMs: Date.now() - startTime,
        usage: { input: 10, output: 20 },
      };
    }

    // Default 'ok' mode
    let data: any;
    if (req.schemaName === 'chat_reply') {
      data = {
        reply: 'Dạ em có thể hỗ trợ gì thêm cho anh/chị ạ?',
        intent: 'general_inquiry',
      };
    } else if (req.schemaName === 'lead_extraction') {
      data = {
        name: 'Khách hàng',
        phone: '0983000000',
        note: 'Yêu cầu tư vấn nệm mầm non',
      };
    } else {
      data = {
        ok: true,
        reply: 'Dạ vâng, em ghi nhận thông tin của anh/chị rồi ạ.',
      };
    }

    return {
      data: data as T,
      model: 'fake-model',
      latencyMs: Date.now() - startTime,
      usage: { input: 10, output: 15 },
    };
  }
}
