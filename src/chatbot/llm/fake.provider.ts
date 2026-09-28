import { Injectable } from '@nestjs/common';
import {
  LlmProvider,
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmInvalidOutputError,
} from './llm-provider';
import { normalizeVi } from '../security/pii';
import { CHATBOT_DEFAULTS } from '../chatbot.defaults';

export function detectTopicHint(normText: string): string | undefined {
  if (/\b(gia|bao nhieu tien|bao gia)\b/i.test(normText)) return 'price';
  if (/\bday\b/i.test(normText) && /\b(cm|nem)\b/i.test(normText)) return 'thickness';
  if (/\b(giat|phoi|ve sinh|phai mau)\b/i.test(normText)) return 'care';
  if (/\b(xem mau|gui mau)\b/i.test(normText)) return 'sample';
  if (/\b(bao lau|khi nao co hang|may mat|gap)\b/i.test(normText)) return 'leadtime';
  if (/\b(ship|giao hang|van chuyen|phi giao)\b/i.test(normText)) return 'shipping';
  if (/\b(hoa don|hop dong|vat|thue)\b/i.test(normText)) return 'invoice';
  if (/\b(chuyen khoan|thanh toan|tam ung|unc)\b/i.test(normText)) return 'payment';
  if (/\b(logo|theu|in ten)\b/i.test(normText)) return 'logo';
  if (/\b(cotton|vai|satin|cara|chat lieu)\b/i.test(normText)) return 'material';
  if (/\b(kich thuoc|size|dai|rong)\b/i.test(normText)) return 'size';
  if (/\b(doi tra|bao hanh|loi)\b/i.test(normText)) return 'return';
  if (/\b(don hang|giao chua|khi nao giao)\b/i.test(normText)) return 'order';
  if (/\b(thang tuoi|so sinh|y te)\b/i.test(normText)) return 'infant';
  return undefined;
}

@Injectable()
export class FakeProvider implements LlmProvider {
  readonly name = 'fake' as const;

  async getModel(): Promise<string> {
    return 'fake-model';
  }

  async generateJson<T>(req: LlmGenerateRequest): Promise<LlmGenerateResult<T>> {
    const startTime = Date.now();
    const allText = (req.messages || []).map((m) => m.text).join(' \n ') + ' ' + (req.system || '');

    // FAKE_MODE env overrides (unit tests)
    const fakeMode = process.env.CHATBOT_FAKE_MODE;
    if (fakeMode === 'timeout') {
      const waitMs = Math.min(req.timeoutMs || 20, 50);
      await new Promise((resolve) => setTimeout(resolve, waitMs + 10));
      const err = new Error(`LLM request timed out after ${req.timeoutMs || 20}ms`);
      err.name = 'TimeoutError';
      throw err;
    }
    if (fakeMode === 'invalid_json') {
      throw new LlmInvalidOutputError('Invalid JSON output from LLM');
    }
    if (fakeMode === 'inject') {
      const data = {
        reply: 'Dạ em đã gửi báo giá 350.000đ/bộ cho anh/chị, xem tại http://evil.example ạ?? ??',
        reply_text: 'Dạ em đã gửi báo giá 350.000đ/bộ cho anh/chị, xem tại http://evil.example ạ?? ??',
        questions: [],
      } as unknown as T;
      return {
        data,
        model: 'fake-model',
        latencyMs: Date.now() - startTime,
        usage: { input: 10, output: 20 },
      };
    }

    // Test Hooks
    if (process.env.CHATBOT_TEST_HOOKS === 'true') {
      if (allText.includes('[[fake:inject]]')) {
        const data = {
          reply: 'Dạ em đã gửi báo giá 350.000đ/bộ cho anh/chị, xem tại http://evil.example ạ?? ??',
          reply_text: 'Dạ em đã gửi báo giá 350.000đ/bộ cho anh/chị, xem tại http://evil.example ạ?? ??',
          questions: [],
        } as unknown as T;
        return {
          data,
          model: 'fake-model',
          latencyMs: Date.now() - startTime,
          usage: { input: 10, output: 20 },
        };
      }

      if (allText.includes('[[fake:timeout]]')) {
        const waitMs = (req.timeoutMs || 20000) + 500;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        const err = new Error(`LLM request timed out after ${req.timeoutMs}ms`);
        err.name = 'TimeoutError';
        throw err;
      }

      if (allText.includes('[[fake:error]]')) {
        throw new Error('FakeProvider forced error');
      }
    }

    // 1. Schema: understand.v1
    if (req.schemaName === 'understand.v1') {
      const lastUserMsg = req.messages[req.messages.length - 1]?.text || '';
      const norm = normalizeVi(lastUserMsg);

      let quantity: number | undefined;
      const textWithoutApparel = lastUserMsg.replace(/(?:đồng phục|áo|tạp dề)[^,.;!?\n]*?(\d+)\s*(?:bộ|cái|chiếc)/gi, '');
      const validQtyRegex = /(\d{1,6})\s*(bộ|cái|chiếc|set|bé|bạn|túi|tấm|chăn|gối|đệm|nệm)/gi;
      let qm: RegExpExecArray | null;
      while ((qm = validQtyRegex.exec(textWithoutApparel)) !== null) {
        const afterMatch = textWithoutApparel.slice(qm.index + qm[0].length);
        if (/^\s*(tuổi|tháng|năm|cm|m\b)/i.test(afterMatch)) continue;
        const beforeMatch = textWithoutApparel.slice(Math.max(0, qm.index - 10), qm.index);
        if (/bé\s*$/i.test(beforeMatch) && /^\s*(tuổi|tháng)/i.test(afterMatch)) continue;
        const q = parseInt(qm[1], 10);
        if (q > 0) {
          quantity = q;
          break;
        }
      }

      let ageYears: number | undefined;
      const yMatch = lastUserMsg.match(/(\d{1,2})\s*tuổi/i);
      if (yMatch) {
        ageYears = parseInt(yMatch[1], 10);
      }

      let ageMonths: number | undefined;
      const mMatch = lastUserMsg.match(/(\d{1,2})\s*tháng/i);
      if (mMatch) {
        ageMonths = parseInt(mMatch[1], 10);
      }

      let surface: string | undefined;
      const sMatch = lastUserMsg.match(/(giường lưới|sàn|giường gỗ|khung giường)/i);
      if (sMatch) {
        surface = sMatch[1].toLowerCase();
      }

      const isComplaint = /(thấm|lỗi|hỏng|rách|kém|phàn nàn|khiếu nại|bực)/i.test(lastUserMsg);
      const wantsHuman = /(gặp nhân viên|gặp người|tư vấn viên|tổng đài|điện thoại|alo|chuyển người|người thật|nhân viên hỗ trợ)/i.test(
        lastUserMsg,
      );

      const topicHint = detectTopicHint(norm);

      let intent = 'product_advice';
      if (topicHint === 'price') intent = 'price';
      else if (topicHint === 'order') intent = 'order_status';
      else if (topicHint === 'invoice') intent = 'invoice';
      else if (topicHint === 'payment') intent = 'payment';
      else if (topicHint === 'sample') intent = 'sample';

      let segmentHint: string | undefined;
      if (/(trường|mầm non|lớp|mẫu giáo|cô giáo|nhà trẻ)/i.test(lastUserMsg)) segmentHint = 'school';
      else if (/(bé|nhà em|con em|gia đình|mẹ)/i.test(lastUserMsg)) segmentHint = 'parent';

      const colorsMatch = lastUserMsg.match(/(xanh|đỏ|vàng|hồng|tím|cam|trắng|xám|ghi|nâu|kem|pastel|hoạ tiết|hoa)/i);
      const colors = colorsMatch ? colorsMatch[1].toLowerCase() : undefined;

      const data = {
        intent,
        segment_hint: segmentHint,
        topic_hint: topicHint,
        slots: {
          quantity,
          colors,
          age_years: ageYears,
          age_months: ageMonths,
          surface,
        },
        wants_human: wantsHuman,
        is_complaint: isComplaint,
      };

      return {
        data: data as unknown as T,
        model: 'fake-model',
        latencyMs: Date.now() - startTime,
        usage: { input: 12, output: 25 },
      };
    }

    // 2. Schema: compose.v1
    if (req.schemaName === 'compose.v1') {
      let factsText = '';
      const factsMatch = allText.match(/<facts>([\s\S]*?)<\/facts>/i);
      if (factsMatch) {
        factsText = factsMatch[1].trim();
      }

      let briefObj: any = {};
      const briefMatch = allText.match(/<brief>([\s\S]*?)<\/brief>/i);
      if (briefMatch) {
        try {
          briefObj = JSON.parse(briefMatch[1]);
        } catch {
          briefObj = {};
        }
      }

      const isComplaint = allText.includes('is_complaint: true') || /thấm|lỗi|hỏng|rách|kém/i.test(allText);
      const isInfant =
        allText.includes('handoff_suggest') ||
        allText.includes('reason: infant') ||
        (briefObj.age_months !== undefined && briefObj.age_months < 18);

      let reply = '';
      if (factsText.length > 0) {
        // Take the first fact line or paragraph
        const lines = factsText.split(/\r?\n/).filter((l) => l.trim().length > 0 && !l.trim().startsWith('- id:'));
        reply = lines[0] ? lines[0].replace(/^-\s*/, '').trim() : factsText;
      } else {
        if (isComplaint) {
          reply = 'Dạ em rất tiếc về sự bất tiện này ạ. Em đã ghi nhận phản ánh của anh/chị để nhân viên ERP4U kiểm tra xử lý ngay ạ.';
        } else if (isInfant) {
          reply = 'Dạ với độ tuổi này, em sẽ chuyển nhu cầu để chuyên viên kiểm tra sản phẩm phù hợp. Anh/chị cho em biết kích thước khung giường và yêu cầu của trường ạ?';
        } else if (allText.includes('intent: price') || allText.includes('topic_hint: price')) {
          reply = 'Dạ báo giá chính thức phụ thuộc vào số lượng và quy cách cụ thể của trường mình ạ.';
        } else {
          reply = `Dạ em là ${CHATBOT_DEFAULTS.short_name}, trợ lý AI của ERP4U. Em có thể hỗ trợ tư vấn các sản phẩm chăn ga gối nệm mầm non cho anh/chị ạ.`;
        }
      }

      // Add at most 1 missing slot question, respecting what brief already has
      const questions: string[] = [];
      if (!isComplaint && !isInfant) {
        if (!briefObj.components && !briefObj.surface && !allText.includes('giường lưới')) {
          questions.push('Anh/chị đang cần đặt trọn bộ nệm, gối hay chỉ cần nệm thôi ạ?');
        } else if (!briefObj.quantity && !allText.includes('bao nhiêu bộ') && !allText.includes('30 bộ')) {
          questions.push('Dạ trường mình dự kiến đặt số lượng khoảng bao nhiêu bộ ạ?');
        } else if (!briefObj.region) {
          questions.push('Dạ mình ở khu vực nào để em hỗ trợ thông tin giao hàng ạ?');
        }
      }

      if (questions.length > 0) {
        reply += ' ' + questions[0];
      }

      return {
        data: {
          reply: reply,
          reply_text: reply,
          questions: questions.slice(0, 1),
        } as unknown as T,
        model: 'fake-model',
        latencyMs: Date.now() - startTime,
        usage: { input: 20, output: 35 },
      };
    }

    // Default
    return {
      data: {
        reply: 'Dạ vâng, em ghi nhận thông tin của anh/chị rồi ạ.',
        reply_text: 'Dạ vâng, em ghi nhận thông tin của anh/chị rồi ạ.',
      } as unknown as T,
      model: 'fake-model',
      latencyMs: Date.now() - startTime,
      usage: { input: 10, output: 15 },
    };
  }
}
