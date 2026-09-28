export const COMMITMENT_PHRASES = [
  'đã gửi',
  'đã tiếp nhận',
  'đã nhận tiền',
  'đã chuyển khoản',
  'đã dừng',
  'đã đặt lịch',
  'đã giao',
  'cam kết',
  'chắc chắn',
  'an toàn tuyệt đối',
  'kháng khuẩn',
  'chống thấm',
  'đạt chuẩn',
];

export const MONEY_REGEX = /\d[\d.,]*\s*(k\b|nghìn|ngàn|triệu|tr\b|đ\b|đồng|vnđ|vnd|%)/i;

export function redactPiiForLlm(text: string): string {
  if (!text) return '';
  let out = text;
  // Emails
  out = out.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
  // Phone numbers (VN format +84 or 0 followed by 9-10 digits)
  out = out.replace(/(\+84|0)([\s.-]*\d){9,10}\b/g, '[SĐT]');
  // 9-14 consecutive digits
  out = out.replace(/\b\d{9,14}\b/g, '[SỐ]');
  return out;
}

export interface ValidationContext {
  factsText: string;
  briefData?: Record<string, any>;
  intent?: string;
  fallbackKnowledgeAnswer?: string;
}

export interface ValidationResult {
  valid: boolean;
  replyText: string;
  validator?: {
    blocked: boolean;
    rules: string[];
  };
}

export function validateReply(text: string, ctx: ValidationContext): ValidationResult {
  const rules: string[] = [];
  const lowerText = text.toLowerCase();
  const lowerFacts = (ctx.factsText || '').toLowerCase();

  // (a) Money or % not in facts or brief
  const moneyMatches = text.match(/\d[\d.,]*\s*(k\b|nghìn|ngàn|triệu|tr\b|đ\b|đồng|vnđ|vnd|%)/gi);
  if (moneyMatches && moneyMatches.length > 0) {
    const briefStr = JSON.stringify(ctx.briefData || {});
    for (const m of moneyMatches) {
      const cleanM = m.trim().toLowerCase();
      // Check if this money/number appears in facts or brief
      if (!lowerFacts.includes(cleanM) && !briefStr.toLowerCase().includes(cleanM)) {
        rules.push('money_not_in_facts');
        break;
      }
    }
  }

  // (b) Commitment phrases
  for (const phrase of COMMITMENT_PHRASES) {
    if (lowerText.includes(phrase) && !lowerFacts.includes(phrase)) {
      rules.push('commitment_phrase');
      break;
    }
  }

  // (c) URLs
  if (/(https?:\/\/|www\.)[^\s]+/i.test(text)) {
    rules.push('url_detected');
  }

  // (d) Too many ? marks (> 2)
  const qCount = (text.match(/\?/g) || []).length;
  if (qCount > 2) {
    rules.push('too_many_questions');
  }

  // (e) Phone or email
  if (/(0\d{9,10}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i.test(text)) {
    rules.push('pii_detected');
  }

  if (rules.length === 0) {
    return {
      valid: true,
      replyText: text,
    };
  }

  // Choose safe replacement text
  let safeReply = ctx.fallbackKnowledgeAnswer;
  if (!safeReply) {
    if (ctx.intent === 'price') {
      safeReply = 'Dạ báo giá chính thức phụ thuộc vào số lượng và quy cách cụ thể của trường mình ạ.';
    } else if (ctx.intent === 'order_status') {
      safeReply = 'Dạ hiện tại em chưa kết nối trực tiếp với hệ thống đơn hàng, em xin phép nhờ nhân viên kiểm tra và báo lại anh/chị ạ.';
    } else {
      safeReply = 'Dạ em ghi nhận câu hỏi của anh/chị, em sẽ nhờ nhân viên ERP4U kiểm tra thêm ạ.';
    }
  }

  return {
    valid: false,
    replyText: safeReply,
    validator: {
      blocked: true,
      rules,
    },
  };
}
