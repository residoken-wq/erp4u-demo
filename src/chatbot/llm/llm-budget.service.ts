import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatbotConfigService } from '../config/chatbot-config.service';

export function getVietnamDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  let year = '';
  let month = '';
  let day = '';
  for (const p of parts) {
    if (p.type === 'year') year = p.value;
    if (p.type === 'month') month = p.value;
    if (p.type === 'day') day = p.value;
  }
  return `${year}${month}${day}`;
}

@Injectable()
export class LlmBudgetService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ChatbotConfigService,
  ) {}

  getTodayConfigKey(date: Date = new Date()): string {
    const ymd = getVietnamDateString(date);
    return `CHATBOT_LLM_USAGE_${ymd}`;
  }

  async tryConsume(budgetOverride?: number): Promise<boolean> {
    const config = await this.configService.get();
    const budget =
      typeof budgetOverride === 'number' ? budgetOverride : config.llm.daily_call_budget;
    const key = this.getTodayConfigKey();

    // 1. Ensure initial row exists with '0'
    await this.dataSource.query(
      `INSERT INTO system_configs (key, value, description)
       VALUES ($1, '0', 'Daily LLM call usage')
       ON CONFLICT (key) DO NOTHING`,
      [key],
    );

    // 2. Atomically increment only if current value < budget
    const updateResult = await this.dataSource.query(
      `UPDATE system_configs
       SET value = ((value::int) + 1)::text
       WHERE key = $1 AND (value::int) < $2
       RETURNING (value::int) as count`,
      [key, budget],
    );

    return Array.isArray(updateResult) && updateResult.length > 0;
  }

  async getTodayCalls(): Promise<number> {
    const key = this.getTodayConfigKey();
    const rows = await this.dataSource.query(
      `SELECT value FROM system_configs WHERE key = $1`,
      [key],
    );
    if (rows && rows.length > 0 && rows[0].value) {
      return parseInt(rows[0].value, 10) || 0;
    }
    return 0;
  }
}
