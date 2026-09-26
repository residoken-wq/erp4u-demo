import { FakeProvider } from '../llm/fake.provider';
import { GeminiProvider } from '../llm/gemini.provider';
import { LlmInvalidOutputError } from '../llm/llm-provider';

describe('LLM Providers (CB0-19)', () => {
  describe('FakeProvider', () => {
    let fake: FakeProvider;

    beforeEach(() => {
      fake = new FakeProvider();
      delete process.env.CHATBOT_FAKE_MODE;
    });

    it('returns minimal valid object in default ok mode', async () => {
      const res = await fake.generateJson({
        system: '',
        messages: [{ role: 'user', text: 'Xin chào' }],
        schemaName: 'chat_reply',
        jsonSchema: {},
        timeoutMs: 5000,
      });
      expect(res.model).toBe('fake-model');
      expect((res.data as any).reply).toBeDefined();
    });

    it('returns injection text in inject mode (P3 pre-check)', async () => {
      process.env.CHATBOT_FAKE_MODE = 'inject';
      const res = await fake.generateJson({
        system: '',
        messages: [{ role: 'user', text: 'Báo giá' }],
        schemaName: 'chat_reply',
        jsonSchema: {},
        timeoutMs: 5000,
      });
      expect((res.data as any).reply).toContain('đã gửi');
      expect((res.data as any).reply).toContain('350.000đ');
    });

    it('throws timeout error in timeout mode', async () => {
      process.env.CHATBOT_FAKE_MODE = 'timeout';
      await expect(
        fake.generateJson({
          system: '',
          messages: [{ role: 'user', text: 'Alo' }],
          schemaName: 'chat_reply',
          jsonSchema: {},
          timeoutMs: 20,
        }),
      ).rejects.toThrow();
    });

    it('throws LlmInvalidOutputError in invalid_json mode', async () => {
      process.env.CHATBOT_FAKE_MODE = 'invalid_json';
      await expect(
        fake.generateJson({
          system: '',
          messages: [{ role: 'user', text: 'Alo' }],
          schemaName: 'chat_reply',
          jsonSchema: {},
          timeoutMs: 5000,
        }),
      ).rejects.toThrow(LlmInvalidOutputError);
    });
  });

  describe('GeminiProvider with mocked fetch', () => {
    it('successfully parses 200 JSON schema response', async () => {
      const mockFetch: any = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ reply: 'Dạ chào bạn!', intent: 'greeting' }) }],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 10 },
        }),
      });

      const provider = new GeminiProvider('fake-test-key', 'gemini-1.5-flash', mockFetch);
      const res = await provider.generateJson({
        system: 'System prompt',
        messages: [{ role: 'user', text: 'Chào em' }],
        schemaName: 'chat_reply',
        jsonSchema: {},
        timeoutMs: 5000,
      });

      expect(res.data).toEqual({ reply: 'Dạ chào bạn!', intent: 'greeting' });
      expect(res.usage?.input).toBe(15);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = mockFetch.mock.calls[0];
      expect(calledUrl).not.toContain('key=');
      expect(calledInit.headers['x-goog-api-key']).toBe('fake-test-key');
    });

    it('retries once upon 429 and succeeds on second attempt', async () => {
      let callCount = 0;
      const mockFetch: any = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 429,
            text: async () => 'Rate limit exceeded',
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify({ reply: 'Thành công sau retry' }) }],
                },
              },
            ],
          }),
        };
      });

      const provider = new GeminiProvider('fake-test-key', 'gemini-1.5-flash', mockFetch);
      const res = await provider.generateJson({
        system: '',
        messages: [{ role: 'user', text: 'Hi' }],
        schemaName: 'chat_reply',
        jsonSchema: {},
        timeoutMs: 5000,
      });

      expect(callCount).toBe(2);
      expect(res.data).toEqual({ reply: 'Thành công sau retry' });
    });

    it('throws LlmInvalidOutputError when response candidate is not valid JSON', async () => {
      const mockFetch: any = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'This is not valid JSON' }],
              },
            },
          ],
        }),
      });

      const provider = new GeminiProvider('fake-test-key', 'gemini-1.5-flash', mockFetch);
      await expect(
        provider.generateJson({
          system: '',
          messages: [{ role: 'user', text: 'Hi' }],
          schemaName: 'chat_reply',
          jsonSchema: {},
          timeoutMs: 5000,
        }),
      ).rejects.toThrow(LlmInvalidOutputError);
    });
  });
});
