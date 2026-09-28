import { Injectable, Logger } from '@nestjs/common';
import { ChatbotConfigType } from '../chatbot.defaults';
import { isWithinWorkingHours } from '../config/working-hours';

export interface ScriptedSlotResult {
  slots: Record<string, any>;
  hasNewSlots: boolean;
}

export interface ScriptedResponse {
  replyText: string | null;
  payload: any | null;
  newState?: string;
  isHumanRequest: boolean;
}

@Injectable()
export class ScriptedResponderService {
  private readonly logger = new Logger(ScriptedResponderService.name);

  /**
   * Extract slots using deterministic regex (no LLM in P2)
   */
  extractSlots(text: string, currentData: Record<string, any> = {}): ScriptedSlotResult {
    const slots: Record<string, any> = {};
    let hasNewSlots = false;

    if (!text) {
      return { slots, hasNewSlots };
    }

    // 1. Quantity: (\d{1,6})\s*(bộ|cái|chiếc|set|bé|bạn|túi|tấm|chăn|gối|đệm|nệm)
    const textWithoutApparel = text.replace(/(?:đồng phục|áo|tạp dề)[^,.;!?\n]*?(\d+)\s*(?:bộ|cái|chiếc)/gi, '');
    const validQtyRegex = /(\d{1,6})\s*(bộ|cái|chiếc|set|bé|bạn|túi|tấm|chăn|gối|đệm|nệm)/gi;
    let qm: RegExpExecArray | null;
    while ((qm = validQtyRegex.exec(textWithoutApparel)) !== null) {
      const afterMatch = textWithoutApparel.slice(qm.index + qm[0].length);
      if (/^\s*(tuổi|tháng|năm|cm\b)/i.test(afterMatch)) continue;
      const beforeMatch = textWithoutApparel.slice(Math.max(0, qm.index - 10), qm.index);
      if (/bé\s*$/i.test(beforeMatch) && /^\s*(tuổi|tháng)/i.test(afterMatch)) continue;
      const q = parseInt(qm[1], 10);
      if (q > 0 && q !== currentData.quantity) {
        slots.quantity = q;
        hasNewSlots = true;
        break;
      }
    }

    // 2. Colors: màu\s+([\p{L} ]{2,20})
    const colorMatch = text.match(/màu\s+([\p{L} ]{2,20})/iu);
    if (colorMatch) {
      const col = colorMatch[1].trim();
      if (col && col !== currentData.colors) {
        slots.colors = col;
        hasNewSlots = true;
      }
    }

    // 3. Segment
    if (/mầm non|mẫu giáo|lớp|trường/i.test(text)) {
      if (currentData.segment !== 'school') {
        slots.segment = 'school';
        hasNewSlots = true;
      }
    } else if (/cho bé|con tôi|con mình/i.test(text)) {
      if (currentData.segment !== 'parent') {
        slots.segment = 'parent';
        hasNewSlots = true;
      }
    }

    // 4. Items (nệm, gối, chăn, ga)
    const items: string[] = Array.isArray(currentData.items) ? [...currentData.items] : [];
    let itemsChanged = false;
    if (/nệm|đệm/i.test(text) && !items.includes('nệm')) {
      items.push('nệm');
      itemsChanged = true;
    }
    if (/gối/i.test(text) && !items.includes('gối')) {
      items.push('gối');
      itemsChanged = true;
    }
    if (/chăn/i.test(text) && !items.includes('chăn')) {
      items.push('chăn');
      itemsChanged = true;
    }
    if (/ga/i.test(text) && !items.includes('ga')) {
      items.push('ga');
      itemsChanged = true;
    }
    if (itemsChanged) {
      slots.items = items;
      hasNewSlots = true;
    }

    return { slots, hasNewSlots };
  }

  isHumanRequest(text?: string, action?: string): boolean {
    if (action === 'human') return true;
    if (!text) return false;
    return /nhân viên|gặp người|người thật|tư vấn viên|sales/i.test(text);
  }

  generateStartReply(value: string, config: ChatbotConfigType): { replyText: string; segment: string; intent: string } {
    let segment = 'school';
    let intent = value;
    let replyText = '';

    if (value === 'school') {
      segment = 'school';
      intent = 'school';
      replyText =
        'Dạ em chào anh/chị ạ. Trường mình đang cần nệm, gối hay cả bộ, và dự kiến khoảng bao nhiêu bộ ạ?';
    } else if (value === 'parent') {
      segment = 'parent';
      intent = 'parent';
      replyText =
        'Dạ em chào anh/chị ạ. Mình đang tìm nệm ngủ trưa hay bộ chăn ga gối cho bé và bé nhà mình mấy tuổi rồi ạ?';
    } else if (value === 'sample') {
      segment = 'school';
      intent = 'sample';
      replyText =
        'Dạ em chào anh/chị ạ. Anh/chị đang quan tâm xem mẫu nệm, gối hay phụ kiện mầm non nào ạ?';
    } else if (value === 'support') {
      segment = 'after_sale';
      intent = 'support';
      replyText =
        'Dạ em chào anh/chị ạ. Anh/chị đang cần hỗ trợ về đơn hàng đã đặt hay thông tin sản phẩm nào ạ?';
    } else {
      segment = 'school';
      intent = 'school';
      replyText =
        'Dạ em chào anh/chị ạ. Anh/chị đang tìm sản phẩm cho trường mầm non hay cho bé nhà mình ạ?';
    }

    return { replyText, segment, intent };
  }

  generateHumanReply(config: ChatbotConfigType): string {
    const isOpen = isWithinWorkingHours(new Date(), config.working_hours);
    if (!isOpen) {
      return (
        'Dạ em đã chuyển để nhân viên ERP4U hỗ trợ anh/chị ạ. ' +
        'Hiện tại ngoài khung giờ làm việc của công ty, nhân viên ERP4U sẽ liên hệ lại anh/chị khi bắt đầu ca làm việc tiếp theo ạ.'
      );
    }

    if (config.response_sla_text) {
      return `Dạ em đã chuyển để nhân viên ERP4U hỗ trợ anh/chị. ${config.response_sla_text}`;
    }

    return 'Dạ em đã chuyển để nhân viên ERP4U hỗ trợ anh/chị ạ. Nhân viên phụ trách sẽ liên hệ với anh/chị ạ.';
  }

  generateResponse(
    text: string,
    briefData: Record<string, any>,
    revision: number,
    config: ChatbotConfigType,
  ): ScriptedResponse {
    // 1. Check human request
    if (this.isHumanRequest(text)) {
      return {
        replyText: this.generateHumanReply(config),
        payload: null,
        newState: 'waiting_sales',
        isHumanRequest: true,
      };
    }

    // 2. Check if brief is minimally sufficient
    // (items.length > 0 || segment === 'school') && quantity
    const hasItemsOrSchool = (briefData.items && briefData.items.length > 0) || briefData.segment === 'school';
    const hasQuantity = typeof briefData.quantity === 'number' && briefData.quantity > 0;
    const isSufficient = hasItemsOrSchool && hasQuantity;

    if (isSufficient) {
      // Return summary card payload and transition to request_review
      const itemsStr = briefData.items?.length ? briefData.items.join(', ') : 'bộ';
      const replyText =
        `Dạ em đã ghi nhận thông tin nhu cầu: ${briefData.quantity} ${itemsStr}` +
        (briefData.colors ? ` màu ${briefData.colors}` : '') +
        '. Anh/chị kiểm tra lại thông tin tóm tắt bên dưới hoặc gửi yêu cầu để nhân viên báo giá chi tiết nhé!';

      return {
        replyText,
        payload: {
          type: 'summary',
          brief_revision: revision,
          fields: briefData,
        },
        newState: 'request_review',
        isHumanRequest: false,
      };
    }

    // 3. If missing quantity or items
    if (!hasQuantity) {
      return {
        replyText:
          'Dạ em đã ghi nhận thông tin ạ. Anh/chị dự kiến đặt số lượng khoảng bao nhiêu bộ để em báo nhân viên hỗ trợ ạ?',
        payload: null,
        isHumanRequest: false,
      };
    }

    if (!briefData.items || briefData.items.length === 0) {
      return {
        replyText:
          'Dạ anh/chị đang cần nệm, gối hay bộ nệm kèm gối và mền ạ?',
        payload: null,
        isHumanRequest: false,
      };
    }

    return {
      replyText: 'Dạ em đã ghi nhận thông tin của mình rồi ạ. Anh/chị có cần tư vấn thêm chi tiết nào nữa không ạ?',
      payload: null,
      isHumanRequest: false,
    };
  }
}
