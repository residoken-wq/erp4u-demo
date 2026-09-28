import { Injectable } from '@nestjs/common';
import { normalizeVi } from '../security/pii';

export interface RuleUnderstandResult {
  intent: string;
  segment?: string;
  topic_hint?: string;
  slots: {
    quantity?: number;
    colors?: string;
    age_years?: number;
    age_months?: number;
    surface?: string;
    items?: string[];
    [key: string]: any;
  };
  wants_human: boolean;
  is_complaint: boolean;
  is_infant: boolean;
  suggest_ticket?: {
    category: 'complaint_quality' | 'design_change' | 'delivery';
  };
  handoff: boolean;
  handoff_reason?: string;
}

@Injectable()
export class RuleUnderstanderService {
  understand(text: string, currentData: Record<string, any> = {}): RuleUnderstandResult {
    const raw = text || '';
    const norm = normalizeVi(raw);

    // 1. Age extraction first (so numbers paired with tuổi/tháng are not confused with quantity)
    let ageYears: number | undefined = currentData.age_years;
    const yMatch = raw.match(/(\d{1,2})\s*tuổi/i);
    if (yMatch) {
      ageYears = parseInt(yMatch[1], 10);
    }

    let ageMonths: number | undefined = currentData.age_months;
    const mRangeMatch = raw.match(/(?:từ\s*)?(\d{1,2})\s*(?:đến|-|–)\s*(\d{1,2})\s*tháng/i);
    if (mRangeMatch) {
      ageMonths = Math.max(parseInt(mRangeMatch[1], 10), parseInt(mRangeMatch[2], 10));
    } else {
      const mMatch = raw.match(/(\d{1,2})\s*tháng/i);
      if (mMatch) {
        ageMonths = parseInt(mMatch[1], 10);
      }
    }
    if (ageMonths === undefined && /sơ sinh/i.test(raw)) {
      ageMonths = 1;
    }

    // 2. Quantity extraction (m6 fix)
    // Rule: numbers followed by tuổi, tháng, năm, cm, m, kg are NEVER quantities.
    // Numbers attached to đồng phục / áo / tạp dề are NOT mattress quantities (S3-25).
    let quantity: number | undefined = currentData.quantity;

    // Remove uniforms/apparel clauses to prevent extracting apparel quantity (e.g. "may đồng phục khoảng 20 bộ")
    const textWithoutApparel = raw.replace(/(?:đồng phục|áo|tạp dề)[^,.;!?\n]*?(\d+)\s*(?:bộ|cái|chiếc)/gi, '');

    // Match patterns of (number) (unit)
    const validQtyRegex = /(\d{1,6})\s*(bộ|cái|chiếc|set|bé|bạn|túi|tấm|chăn|gối|đệm|nệm)/gi;
    let match: RegExpExecArray | null;
    while ((match = validQtyRegex.exec(textWithoutApparel)) !== null) {
      const numStr = match[1];
      const unit = match[2].toLowerCase();
      const matchIndex = match.index;
      const afterMatch = textWithoutApparel.slice(matchIndex + match[0].length);

      // Check if after match has tuổi, tháng, năm, cm
      if (/^\s*(tuổi|tháng|năm|cm\b)/i.test(afterMatch)) {
        continue;
      }

      // Check if preceded by "Bé" right before the number and followed by tuổi (e.g. "Bé 4 tuổi")
      const beforeMatch = textWithoutApparel.slice(Math.max(0, matchIndex - 10), matchIndex);
      if (/bé\s*$/i.test(beforeMatch) && /^\s*(tuổi|tháng)/i.test(afterMatch)) {
        continue;
      }

      const q = parseInt(numStr, 10);
      if (q > 0) {
        // Found a valid mattress/bedding quantity
        quantity = q;
        break;
      }
    }

    // 3. Surface
    let surface: string | undefined = currentData.surface;
    const sMatch = raw.match(/(giường lưới|sàn|giường gỗ|khung giường)/i);
    if (sMatch) {
      surface = sMatch[1].toLowerCase();
    }

    // 4. Colors
    let colors: string | undefined = currentData.colors;
    const colMatch = raw.match(/màu\s+([\p{L}\d -]{2,25})/iu);
    if (colMatch) {
      colors = colMatch[1].trim();
    } else {
      const cPick = raw.match(/\b(xanh viền trắng|nâu be|xanh đậm|xanh|đỏ|vàng|hồng|tím|cam|trắng|xám|ghi|nâu|kem|pastel)\b/i);
      if (cPick) {
        colors = cPick[1].toLowerCase();
      }
    }

    // 5. Items
    const items: string[] = Array.isArray(currentData.items) ? [...currentData.items] : [];
    if (/nệm|đệm/i.test(raw) && !items.includes('nệm')) items.push('nệm');
    if (/gối/i.test(raw) && !items.includes('gối')) items.push('gối');
    if (/(chăn|mền)/i.test(raw) && !items.includes('chăn')) items.push('chăn');
    if (/túi/i.test(raw) && !items.includes('túi')) items.push('túi');
    if (/ga/i.test(raw) && !items.includes('ga')) items.push('ga');

    // 6. Segment (priority: business > school > parent)
    let segment: string | undefined = currentData.segment;
    if (/đồng phục|thương mại|hợp tác|đại lý|phân phối|khách của em|bên em làm/i.test(raw)) {
      segment = 'business';
    } else if (/trường|mầm non|lớp|mẫu giáo|cô giáo|nhà trẻ|học sinh|bảo quản tại trường/i.test(raw)) {
      if (segment !== 'business') segment = 'school';
    } else if (/cho bé|con em|con tôi|con mình|mẹ|nhà em|phụ huynh|bé nhà em/i.test(raw)) {
      if (segment !== 'business' && segment !== 'school') segment = 'parent';
    }

    // 7. Complaint check
    const isComplaint = /thấm|lỗi|hỏng|rách|kém|thô|phàn nàn|khiếu nại|bực|dơ/i.test(raw);

    // 8. Infant check
    const isInfant =
      (ageMonths !== undefined && ageMonths < 18) ||
      /\b(thang tuoi|so sinh|y te)\b/i.test(norm) ||
      /sơ sinh|y tế/i.test(raw);

    // 9. Wants Human check
    const wantsHuman = /gặp nhân viên|gặp người|tư vấn viên|tổng đài|điện thoại|alo|chuyển người|người thật|nhân viên hỗ trợ|nhờ nhân viên/i.test(
      raw,
    );

    // 10. Intent detection (Priority: complaint > invoice > payment > order_status > sample > reorder > price > product_advice)
    let intent = currentData.intent || 'product_advice';
    if (isComplaint) {
      intent = 'complaint';
    } else if (/hóa đơn|hợp đồng|biên bản|mst|mã số thuế|xuất hóa đơn|pháp nhân|thuế|vat/i.test(raw)) {
      intent = 'invoice';
    } else if (/chuyển khoản|thanh toán|tạm ứng|unc|nhận được tiền chưa|đã chuyển tiền/i.test(raw)) {
      intent = 'payment';
    } else if (/khi nào giao|giao chưa|đơn hàng|lâu không|chưa giao|giao qua|địa chỉ cũ|khi nào có hàng|tiến độ/i.test(raw)) {
      intent = 'order_status';
    } else if (/xem mẫu|gửi mẫu|mẫu vải|chỉ xem|chưa cần báo giá|không báo giá/i.test(raw)) {
      intent = 'sample';
    } else if (/như đợt trước|đặt lại|như cũ|mẫu cũ|đặt thêm|bổ sung/i.test(raw)) {
      intent = 'reorder';
    } else if (/báo giá|giá|bao nhiêu tiền|bao gia|xin giá/i.test(raw)) {
      intent = 'price';
    }

    // 11. Suggest Ticket
    let suggestTicket: { category: 'complaint_quality' | 'design_change' | 'delivery' } | undefined;
    if (/dừng in|dừng thêu|bỏ nền|sửa mockup|bỏ vòng|đổi logo/i.test(raw)) {
      suggestTicket = { category: 'design_change' };
    } else if (/giao.*(giờ nghỉ|trễ|bất tiện)|giao sai/i.test(raw)) {
      suggestTicket = { category: 'delivery' };
    } else if (/thấm|lỗi|hỏng|rách|kém|thô|phàn nàn|khiếu nại|bực/i.test(raw)) {
      suggestTicket = { category: 'complaint_quality' };
    }

    // 12. Handoff Detection
    let handoff = wantsHuman || isInfant;
    let handoffReason: string | undefined;

    if (wantsHuman) {
      handoff = true;
      handoffReason = 'human_request';
    } else if (isInfant) {
      handoff = true;
      handoffReason = 'infant';
    } else if (segment === 'business') {
      handoff = true;
      handoffReason = 'business';
    } else if (intent === 'invoice') {
      handoff = true;
      handoffReason = 'invoice';
    } else if (intent === 'payment') {
      handoff = true;
      handoffReason = 'payment';
    } else if (intent === 'order_status') {
      handoff = true;
      handoffReason = 'order_status';
    } else if (suggestTicket?.category === 'design_change') {
      handoff = true;
      handoffReason = 'design_change';
    } else if (/giảm giá|giá 100 bộ|không xuất hóa đơn/i.test(raw)) {
      handoff = true;
      handoffReason = 'discount';
    } else if (/không chần bông|xem trực tiếp mẫu/i.test(raw)) {
      handoff = true;
      handoffReason = 'custom_spec';
    } else if (/lấy mẫu số 1|mẫu số 1/i.test(raw)) {
      handoff = true;
      handoffReason = 'mockup_approved';
    } else if (/nhắn trên nhóm/i.test(raw)) {
      handoff = true;
      handoffReason = 'quote_reminder';
    } else if (/nhóm chat cũ|lúc trước nhóm nào/i.test(raw)) {
      handoff = true;
      handoffReason = 'lost_chat_group';
    } else if (/cộng tính thuế|tính thuế/i.test(raw)) {
      handoff = true;
      handoffReason = 'tax_question';
    }

    // 13. Topic Hint (for KB retrieval)
    let topicHint: string | undefined;
    if (/\b(gia|bao nhieu tien|bao gia)\b/i.test(norm)) topicHint = 'price';
    else if (/\bday\b/i.test(norm) && /\b(cm|nem)\b/i.test(norm)) topicHint = 'thickness';
    else if (/\b(giat|phoi|ve sinh|phai mau)\b/i.test(norm)) topicHint = 'care';
    else if (/\b(xem mau|gui mau)\b/i.test(norm)) topicHint = 'sample';
    else if (/\b(bao lau|khi nao co hang|may mat|gap)\b/i.test(norm)) topicHint = 'leadtime';
    else if (/\b(ship|giao hang|van chuyen|phi giao)\b/i.test(norm)) topicHint = 'shipping';
    else if (/\b(hoa don|hop dong|vat|thue)\b/i.test(norm)) topicHint = 'invoice';
    else if (/\b(chuyen khoan|thanh toan|tam ung|unc)\b/i.test(norm)) topicHint = 'payment';
    else if (/\b(logo|theu|in ten)\b/i.test(norm)) topicHint = 'logo';
    else if (/\b(cotton|vai|satin|cara|chat lieu)\b/i.test(norm)) topicHint = 'material';
    else if (/\b(kich thuoc|size|dai|rong)\b/i.test(norm)) topicHint = 'size';
    else if (/\b(doi tra|bao hanh|loi)\b/i.test(norm)) topicHint = 'return';
    else if (/\b(don hang|giao chua|khi nao giao)\b/i.test(norm)) topicHint = 'order';
    else if (/\b(thang tuoi|so sinh|y te)\b/i.test(norm) || isInfant) topicHint = 'infant';

    return {
      intent,
      segment,
      topic_hint: topicHint,
      slots: {
        quantity,
        colors,
        age_years: ageYears,
        age_months: ageMonths,
        surface,
        items,
      },
      wants_human: wantsHuman,
      is_complaint: isComplaint,
      is_infant: isInfant,
      suggest_ticket: suggestTicket,
      handoff,
      handoff_reason: handoffReason,
    };
  }
}
