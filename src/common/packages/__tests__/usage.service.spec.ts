import { UsageService } from '../usage.service';
import { UsersService } from '../../../users/users.service';
import { GeminiProvider } from '../../../chatbot/llm/gemini.provider';
import { AiService } from '../../../ai/ai.service';

describe('UsageService (P6b)', () => {
  it('increments same metric and period twice atomically to reach value 2', async () => {
    const store = new Map<string, number>();

    const mockRepo: any = {
      query: jest.fn(async (sql: string, params: any[]) => {
        expect(sql).toContain('INSERT INTO usage_counter');
        expect(sql).toContain('ON CONFLICT (tenant_id, metric, period)');
        expect(sql).toContain('DO UPDATE SET value = usage_counter.value + EXCLUDED.value');

        const [tenantId, metric, period, by] = params;
        const key = `${tenantId}:${metric}:${period}`;
        store.set(key, (store.get(key) || 0) + Number(by));
        return [];
      }),
    };

    const service = new UsageService(mockRepo);
    await service.increment('ai_calls', 1, 'default', '2026-11');
    await service.increment('ai_calls', 1, 'default', '2026-11');

    expect(mockRepo.query).toHaveBeenCalledTimes(2);
    expect(store.get('default:ai_calls:2026-11')).toBe(2);
  });

  it('does not throw when repository query fails (logs warn only)', async () => {
    const mockRepo: any = {
      query: jest.fn().mockRejectedValue(new Error('DB connection lost')),
    };

    const service = new UsageService(mockRepo);
    const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});

    await expect(service.increment('ai_calls')).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('DB connection lost');

    warnSpy.mockRestore();
  });

  it('UsersService.createUser increments users_created on success', async () => {
    const mockUsageService: any = { increment: jest.fn().mockResolvedValue(undefined) };
    const mockUserRepo: any = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((d: any) => d),
      save: jest.fn(async (u: any) => ({ id: 99, ...u })),
    };

    const usersService = new UsersService(
      mockUserRepo,
      {} as any,
      {} as any,
      {} as any,
      { isDemoMode: () => false, isDemoUser: () => false } as any,
      mockUsageService,
    );

    const created: any = await usersService.createUser({
      username: 'demo_user_99',
      password: 'Password123!',
      full_name: 'Demo User 99',
    });

    expect(created.id).toBe(99);
    expect(mockUsageService.increment).toHaveBeenCalledTimes(1);
    expect(mockUsageService.increment).toHaveBeenCalledWith('users_created');
  });

  it('GeminiProvider increments ai_calls on real Gemini response', async () => {
    const mockUsageService: any = { increment: jest.fn().mockResolvedValue(undefined) };
    const mockFetch: any = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ reply: 'Xin chào' }) }],
            },
          },
        ],
      }),
    });

    const provider = new GeminiProvider(
      undefined,
      'test-api-key',
      'gemini-1.5-flash',
      mockFetch,
      mockUsageService,
    );

    const res = await provider.generateJson({
      system: 'sys',
      messages: [{ role: 'user', text: 'Hi' }],
      schemaName: 'test',
      jsonSchema: {},
      timeoutMs: 5000,
    });

    expect(res.data).toEqual({ reply: 'Xin chào' });
    expect(mockUsageService.increment).toHaveBeenCalledTimes(1);
    expect(mockUsageService.increment).toHaveBeenCalledWith('ai_calls');
  });

  it('AiService does NOT increment ai_calls in DEMO_MODE when returning canned response', async () => {
    const mockUsageService: any = { increment: jest.fn().mockResolvedValue(undefined) };
    const mockConfigService: any = { get: jest.fn().mockReturnValue(undefined) };
    const mockDemoModeService: any = { isDemoMode: jest.fn().mockReturnValue(true) };

    const aiService = new AiService(
      {} as any,
      mockConfigService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockDemoModeService,
      mockUsageService,
    );

    const res = await aiService.chat({ message: 'Xin chào' });
    expect(res.text).toContain('Chế độ Demo');
    expect(mockUsageService.increment).not.toHaveBeenCalled();
  });
});
