import type { PackageKey } from '../../config/packages.ts';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && (window as any).__ERP4U_API_URL__) {
    return (window as any).__ERP4U_API_URL__;
  }
  try {
    return (import.meta as any)?.env?.VITE_API_URL || '/api';
  } catch {
    return '/api';
  }
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}

export interface CopilotSourceItem {
  type: string;
  id: string;
  label: string;
  path: string;
}

export interface CopilotToolStep {
  tool: string;
  label: string;
}

export interface ConversationItem {
  id: string;
  title: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_steps?: CopilotToolStep[] | null;
  sources?: CopilotSourceItem[] | null;
  error_code?: string | null;
  created_at: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  messages: ConversationMessage[];
}

export type CopilotSseEvent =
  | { type: 'conversation'; data: { id: string; title: string } }
  | { type: 'step'; data: { tool: string; label: string } }
  | { type: 'answer'; data: { message_id: string; content: string; sources?: CopilotSourceItem[] } }
  | { type: 'error'; data: { code: string; message: string } }
  | { type: 'done'; data: Record<string, never> };

export const ERROR_MESSAGES: Record<string, string> = {
  AI_QUOTA_EXCEEDED: 'Đã hết hạn mức AI của tháng',
  AI_NOT_CONFIGURED: 'AI chưa được cấu hình, liên hệ quản trị viên',
  AI_KEY_MISSING: 'Chưa cấu hình API key AI, liên hệ quản trị viên',
  PACKAGE_NOT_ENABLED: 'Gói tính năng AI chưa được kích hoạt trên hệ thống',
  FORBIDDEN: 'Bạn không có quyền thực hiện yêu cầu này',
  INTERNAL: 'Lỗi xử lý từ hệ thống AI, vui lòng thử lại sau',
};

/**
 * Trả về thông điệp lỗi tiếng Việt thân thiện theo mã lỗi hợp đồng
 */
export function getErrorMessageByCode(code?: string | null, fallbackMessage?: string): string {
  if (code && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }
  return fallbackMessage || 'Có lỗi xảy ra khi xử lý yêu cầu';
}

/**
 * Kiểm tra xem một đường dẫn nguồn (source.path) có an toàn để dùng làm link nội bộ hay không.
 * Phải bắt đầu bằng '/' và tuyệt đối không được chứa '//', 'javascript:', 'http(s):'.
 */
export function isValidSourcePath(path: unknown): path is string {
  if (typeof path !== 'string') return false;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/')) return false;
  if (trimmed.startsWith('//')) return false;
  if (trimmed.includes('//')) return false;
  if (/^(?:javascript|data|vbscript|https?):/i.test(trimmed)) return false;
  return true;
}

/**
 * Kiểm tra xem một liên kết markdown có an toàn không:
 * Chỉ cho phép http(s) hoặc đường dẫn nội bộ bắt đầu bằng '/' (không chứa '//').
 */
export function isValidMarkdownLink(href: unknown): boolean {
  if (typeof href !== 'string') return false;
  const trimmed = href.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return true;
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('//')) {
    return true;
  }
  return false;
}

/**
 * Bộ phân tích cú pháp stream SSE thuần túy (pure function).
 * Phân tích dữ liệu chunk SSE từ buffer, trả về danh sách sự kiện hoàn chỉnh và phần buffer còn sót lại.
 */
export function parseSseBuffer(buffer: string): { events: CopilotSseEvent[]; remaining: string } {
  const events: CopilotSseEvent[] = [];
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');

  // Phần tử cuối cùng là đoạn chưa kết thúc bằng \n\n (nếu kết thúc bằng \n\n thì là rỗng)
  const remaining = parts.pop() ?? '';

  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.split('\n');
    let eventType: string | null = null;
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (!eventType && dataLines.length === 0) continue;

    const rawData = dataLines.join('\n');
    let parsedData: any = {};
    if (rawData) {
      try {
        parsedData = JSON.parse(rawData);
      } catch {
        parsedData = rawData;
      }
    }

    switch (eventType) {
      case 'conversation':
        events.push({ type: 'conversation', data: parsedData });
        break;
      case 'step':
        events.push({ type: 'step', data: parsedData });
        break;
      case 'answer':
        events.push({ type: 'answer', data: parsedData });
        break;
      case 'error':
        events.push({ type: 'error', data: parsedData });
        break;
      case 'done':
        events.push({ type: 'done', data: parsedData });
        break;
      default:
        // Nếu không có event: header nhưng có data thì bỏ qua hoặc kiểm tra dữ liệu
        break;
    }
  }

  return { events, remaining };
}

/**
 * Gợi ý các câu hỏi thông minh khi cuộc hội thoại mới / trống,
 * dựa theo danh sách gói tính năng đang bật (SALES, INVENTORY, PRODUCTION, FINANCE, HR).
 * Luôn trả về 2 - 4 câu hỏi.
 */
export function getSuggestedQuestions(isPackageEnabled: (pkg: PackageKey | string) => boolean): string[] {
  const suggestions: string[] = [];

  if (isPackageEnabled('SALES')) {
    suggestions.push('Doanh thu và khách hàng công nợ cao nhất tháng này?');
  }
  if (isPackageEnabled('INVENTORY')) {
    suggestions.push('Những sản phẩm hay nguyên vật liệu nào sắp hết hàng?');
  }
  if (isPackageEnabled('PRODUCTION')) {
    suggestions.push('Tiến độ và các lệnh sản xuất nào đang trễ hạn?');
  }
  if (isPackageEnabled('FINANCE')) {
    suggestions.push('Tổng hợp thu chi và dòng tiền tháng này?');
  }
  if (isPackageEnabled('HR')) {
    suggestions.push('Thống kê tổng số lượng nhân sự và tình hình chấm công?');
  }

  if (suggestions.length === 0) {
    suggestions.push('Tôi có những công việc hoặc dự án nào cần chú ý?');
    suggestions.push('Tóm tắt tổng quan hoạt động doanh nghiệp hôm nay?');
  }

  return suggestions.slice(0, 4);
}

/**
 * Lấy danh sách hội thoại
 */
export async function getConversations(): Promise<ConversationItem[]> {
  const res = await fetchWithAuth(`${getApiBaseUrl()}/ai/v2/conversations`);
  if (!res.ok) throw new Error(`Lỗi tải danh sách (${res.status})`);
  return res.json();
}

/**
 * Lấy chi tiết một hội thoại kèm lịch sử tin nhắn
 */
export async function getConversationDetail(id: string): Promise<ConversationDetail> {
  const res = await fetchWithAuth(`${getApiBaseUrl()}/ai/v2/conversations/${id}`);
  if (!res.ok) throw new Error(`Lỗi tải chi tiết (${res.status})`);
  return res.json();
}

/**
 * Cập nhật tiêu đề hội thoại
 */
export async function updateConversationTitle(id: string, title: string): Promise<ConversationItem> {
  const res = await fetchWithAuth(`${getApiBaseUrl()}/ai/v2/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Lỗi đổi tên (${res.status})`);
  return res.json();
}

/**
 * Xoá một cuộc hội thoại
 */
export async function deleteConversation(id: string): Promise<void> {
  const res = await fetchWithAuth(`${getApiBaseUrl()}/ai/v2/conversations/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Lỗi xoá (${res.status})`);
}

/**
 * Gửi tin nhắn và nhận stream SSE phản hồi từ AI Gateway (Cloud).
 * Sử dụng fetch() + ReadableStream, kèm AbortSignal để có thể huỷ giữa chừng.
 */
export async function sendChatMessageStream(params: {
  conversation_id?: string;
  message: string;
  signal?: AbortSignal;
  onEvent: (event: CopilotSseEvent) => void;
}): Promise<void> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const response = await fetch(`${getApiBaseUrl()}/ai/v2/conversations/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      conversation_id: params.conversation_id,
      message: params.message,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    let errorCode = 'INTERNAL';
    let errorMessage = `Lỗi kết nối máy chủ (${response.status})`;
    try {
      const errData = await response.json();
      if (errData.code) errorCode = errData.code;
      if (errData.message) errorMessage = errData.message;
    } catch {
      // response body không phải json
    }
    params.onEvent({
      type: 'error',
      data: { code: errorCode, message: errorMessage },
    });
    params.onEvent({ type: 'done', data: {} });
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response stream không khả dụng');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { events, remaining } = parseSseBuffer(buffer);
      buffer = remaining;

      for (const ev of events) {
        params.onEvent(ev);
      }
    }

    if (buffer.trim()) {
      const { events } = parseSseBuffer(buffer + '\n\n');
      for (const ev of events) {
        params.onEvent(ev);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
