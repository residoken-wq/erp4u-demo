import { LlmBudgetService, getVietnamDateString } from '../llm/llm-budget.service';

describe('LLM Budget Service (CB0-20)', () => {
  it('correctly generates Vietnam date string YYYYMMDD', () => {
    const testDate = new Date('2026-09-26T10:00:00.000Z');
    const ymd = getVietnamDateString(testDate);
    expect(ymd).toBe('20260926');
  });

  it('correctly formats today config key', () => {
    const service = new LlmBudgetService({} as any, {} as any);
    const testDate = new Date('2026-09-26T10:00:00.000Z');
    expect(service.getTodayConfigKey(testDate)).toBe('CHATBOT_LLM_USAGE_20260926');
  });

  it('atomic budget consumption: 4 parallel calls with budget=3 results in 3 true and 1 false (CB0-20)', async () => {
    let currentDbValue = 0;
    const mockDataSource: any = {
      query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('INSERT INTO system_configs')) {
          return [];
        }
        if (sql.includes('UPDATE system_configs')) {
          const budget = params[1];
          if (currentDbValue < budget) {
            currentDbValue++;
            return [{ count: currentDbValue }];
          }
          return [];
        }
        return [];
      }),
    };

    const mockConfigService: any = {
      get: jest.fn().mockResolvedValue({
        llm: { daily_call_budget: 3 },
      }),
    };

    const budgetService = new LlmBudgetService(mockDataSource, mockConfigService);

    // Call 4 times in parallel
    const results = await Promise.all([
      budgetService.tryConsume(),
      budgetService.tryConsume(),
      budgetService.tryConsume(),
      budgetService.tryConsume(),
    ]);

    const trueCount = results.filter((r) => r === true).length;
    const falseCount = results.filter((r) => r === false).length;

    expect(trueCount).toBe(3);
    expect(falseCount).toBe(1);
    expect(currentDbValue).toBe(3);
  });
});
