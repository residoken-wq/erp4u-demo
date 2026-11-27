export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link?: string;
  created_at: string;
}

export const BACKOFF_SCHEDULE_MS = [1000, 2000, 5000, 10000, 30000] as const;
export const ERROR_THRESHOLD_FOR_FALLBACK = 3;
export const FALLBACK_POLL_INTERVAL_MS = 60_000; // 60 giây
export const STREAM_RECONNECT_INTERVAL_MS = 300_000; // 5 phút
export const HIDDEN_TAB_DISCONNECT_MS = 300_000; // 5 phút

export type StreamConnectionState = 'connecting' | 'open' | 'backoff' | 'polling';

export type StreamEvent =
  | { type: 'opened' }
  | { type: 'failed'; status?: number }
  | { type: 'closed' };

export interface StreamState {
  state: StreamConnectionState;
  consecutiveErrors: number;
  authErrorCount: number;
}

export type StreamNextAction =
  | 'none'
  | 'open'
  | 'backoff_reconnect'
  | 'refresh_auth'
  | 'poll_fallback';

export interface StreamDecision {
  nextState: StreamState;
  action: StreamNextAction;
  delayMs: number;
}

export const INITIAL_STREAM_STATE: Readonly<StreamState> = Object.freeze({
  state: 'connecting',
  consecutiveErrors: 0,
  authErrorCount: 0,
});

export class StreamHttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`SSE stream HTTP error: ${status}`);
    this.name = 'StreamHttpError';
    this.status = status;
  }
}

/**
 * Quyết định chuyển trạng thái kết nối stream và hành động tiếp theo.
 * Hàm thuần tuý, không có tác dụng phụ.
 */
export function decideStreamTransition(
  currentState: StreamState,
  event: StreamEvent,
): StreamDecision {
  switch (event.type) {
    case 'opened': {
      // Kết nối thành công: reset đếm lỗi và số lần lỗi xác thực, chuyển sang open, dừng poll
      return {
        nextState: {
          state: 'open',
          consecutiveErrors: 0,
          authErrorCount: 0,
        },
        action: 'open',
        delayMs: 0,
      };
    }

    case 'closed': {
      // Đóng bình thường do server (JWT hết hạn, kết nối thứ 6 bị đóng)
      // -> kết nối lại sau backoff, không tính là lỗi liên tiếp quá 1 lần
      if (currentState.state === 'polling') {
        return {
          nextState: currentState,
          action: 'poll_fallback',
          delayMs: STREAM_RECONNECT_INTERVAL_MS,
        };
      }
      return {
        nextState: {
          state: 'backoff',
          consecutiveErrors: 1, // Luôn gán tối đa 1 để không tích luỹ thành >= 3
          authErrorCount: 0,
        },
        action: 'backoff_reconnect',
        delayMs: calculateBackoff(1),
      };
    }

    case 'failed': {
      const isAuthError = event.status === 401 || event.status === 403;

      // Khi đã ở chế độ fallback polling:
      // Lần thử định kỳ 5 phút thất bại không được khởi động lại chuỗi backoff 1s/2s/5s;
      // Vẫn tiếp tục polling 60s và hẹn thử lại stream sau 5 phút.
      if (currentState.state === 'polling') {
        return {
          nextState: {
            state: 'polling',
            consecutiveErrors: currentState.consecutiveErrors + 1,
            authErrorCount: isAuthError ? currentState.authErrorCount + 1 : currentState.authErrorCount,
          },
          action: 'poll_fallback',
          delayMs: STREAM_RECONNECT_INTERVAL_MS,
        };
      }

      // Xử lý lỗi xác thực HTTP 401/403
      if (isAuthError) {
        if (currentState.authErrorCount === 0) {
          // Lần đầu gặp 401/403: không backoff 1 giây; gọi làm mới token một lần
          return {
            nextState: {
              state: 'backoff',
              consecutiveErrors: currentState.consecutiveErrors + 1,
              authErrorCount: 1,
            },
            action: 'refresh_auth',
            delayMs: 0,
          };
        } else {
          // Lần thứ 2 vẫn gặp 401/403 -> chuyển hẳn sang polling 60 giây
          return {
            nextState: {
              state: 'polling',
              consecutiveErrors: currentState.consecutiveErrors + 1,
              authErrorCount: currentState.authErrorCount + 1,
            },
            action: 'poll_fallback',
            delayMs: STREAM_RECONNECT_INTERVAL_MS,
          };
        }
      }

      // Lỗi thông thường (mạng, proxy 502/504, v.v.)
      const newErrors = currentState.consecutiveErrors + 1;
      if (shouldFallbackToPolling(newErrors)) {
        // >= 3 lần lỗi liên tiếp (không lần nào opened) -> chuyển sang polling
        return {
          nextState: {
            state: 'polling',
            consecutiveErrors: newErrors,
            authErrorCount: currentState.authErrorCount,
          },
          action: 'poll_fallback',
          delayMs: STREAM_RECONNECT_INTERVAL_MS,
        };
      } else {
        // Backoff thông thường: lần 1 = 1s, lần 2 = 2s
        const delayMs = calculateBackoff(newErrors);
        return {
          nextState: {
            state: 'backoff',
            consecutiveErrors: newErrors,
            authErrorCount: currentState.authErrorCount,
          },
          action: 'backoff_reconnect',
          delayMs,
        };
      }
    }
  }
}

/**
 * Tính thời gian chờ kết nối lại (backoff) theo số lần lỗi liên tiếp:
 * 1s, 2s, 5s, 10s, tối đa 30s.
 */
export function calculateBackoff(attempt: number): number {
  if (attempt <= 1) return 1000;
  if (attempt === 2) return 2000;
  if (attempt === 3) return 5000;
  if (attempt === 4) return 10000;
  return 30000;
}

/**
 * Kiểm tra xem có nên chuyển sang chế độ fallback poll định kỳ không.
 * Ngưỡng: >= 3 lần lỗi liên tiếp.
 */
export function shouldFallbackToPolling(consecutiveErrors: number): boolean {
  return consecutiveErrors >= ERROR_THRESHOLD_FOR_FALLBACK;
}

/**
 * Gộp một thông báo mới vào đầu danh sách, đảm bảo không trùng id.
 */
export function mergeNotificationItem(
  currentList: NotificationItem[],
  newItem: NotificationItem,
  maxLimit: number = 50,
): NotificationItem[] {
  const withoutNew = currentList.filter((item) => item.id !== newItem.id);
  const result = [newItem, ...withoutNew];
  return result.slice(0, maxLimit);
}

/**
 * Gộp hai danh sách thông báo (ví dụ khi bù sự kiện từ GET /notifications), không trùng id.
 */
export function mergeNotificationLists(
  existingList: NotificationItem[],
  incomingList: NotificationItem[],
  maxLimit: number = 50,
): NotificationItem[] {
  const seen = new Set<number>();
  const result: NotificationItem[] = [];

  for (const item of incomingList) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }

  for (const item of existingList) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }

  return result.slice(0, maxLimit);
}

/**
 * Đếm số lượng thông báo chưa đọc.
 */
export function countUnreadNotifications(list: NotificationItem[]): number {
  return list.filter((item) => !item.is_read).length;
}

/**
 * Phân tích cú pháp chunk SSE nhận được từ ReadableStream.
 * Hỗ trợ nhiều sự kiện trong cùng chunk, bỏ qua dòng comment (: ping),
 * xử lý chunk bị cắt giữa chừng.
 */
export function parseNotificationSseBuffer(buffer: string): {
  events: NotificationItem[];
  remaining: string;
} {
  const events: NotificationItem[] = [];
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const remaining = parts.pop() ?? '';

  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.split('\n');
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith(':')) {
        // Comment / ping heartbeat - bỏ qua
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length > 0) {
      const rawData = dataLines.join('\n');
      try {
        const parsed = JSON.parse(rawData);
        if (parsed && typeof parsed === 'object' && typeof parsed.id === 'number') {
          events.push(parsed as NotificationItem);
        }
      } catch {
        // Bỏ qua payload lỗi định dạng JSON
      }
    }
  }

  return { events, remaining };
}

/**
 * Mở stream SSE kết nối đến backend bằng fetch + ReadableStream.
 */
export async function openNotificationStream(params: {
  streamUrl: string;
  token?: string | null;
  signal: AbortSignal;
  onNotification: (notification: NotificationItem) => void;
  onOpen?: () => void;
}): Promise<void> {
  const token = params.token ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);

  const response = await fetch(params.streamUrl, {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: params.signal,
  });

  if (!response.ok) {
    throw new StreamHttpError(response.status);
  }

  // Chỉ gọi onOpen sau khi response.ok xác nhận thành công
  params.onOpen?.();

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body ReadableStream is not available');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { events, remaining } = parseNotificationSseBuffer(buffer);
      buffer = remaining;

      for (const ev of events) {
        params.onNotification(ev);
      }
    }

    if (buffer.trim()) {
      const { events } = parseNotificationSseBuffer(buffer + '\n\n');
      for (const ev of events) {
        params.onNotification(ev);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
