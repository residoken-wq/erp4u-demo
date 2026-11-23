import { fetchWithAuth, getApiBaseUrl } from './copilotApi';
import { stripDisplayFields } from './draftRoutes';

export interface CopilotDraftItem {
  id: string;
  kind: string;
  title: string;
  summary: string;
}

export interface AiDraftDetail {
  id: string;
  kind: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'expired' | 'executing' | 'failed' | string;
  payload: Record<string, any>;
  expires_at: string;
  result_ref?: { entity: string; id: string | number; path: string } | null;
  error_code?: string | null;
}

export interface DraftConfirmResult {
  draftId: string;
  result_ref: {
    entity: string;
    id: string | number;
    path: string;
  };
}

export interface DraftApiErrorResponse {
  code?: string;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
}

export const DRAFT_ERROR_MESSAGES: Record<string, string> = {
  DRAFT_INVALID: 'Dữ liệu nháp không hợp lệ, vui lòng kiểm tra lại các trường lỗi',
  FORBIDDEN: 'Bạn không có quyền thực hiện hành động này',
  PACKAGE_NOT_ENABLED: 'Gói tính năng của bản nháp này chưa được kích hoạt',
  NOT_FOUND: 'Bản nháp không tồn tại hoặc bạn không có quyền truy cập',
  DRAFT_NOT_PENDING: 'Bản nháp không còn ở trạng thái chờ duyệt',
  EMAIL_RECIPIENT_NOT_ALLOWED: 'Địa chỉ người nhận không thuộc thông tin đã lưu của khách hàng',
  EMAIL_NOT_CONFIGURED: 'Cấu hình gửi email (SMTP) chưa được thiết lập trên hệ thống',
  RATE_LIMITED: 'Bạn đã vượt quá giới hạn thao tác trong giờ, vui lòng thử lại sau',
};

export function getDraftErrorMessage(code?: string | null, fallbackMessage?: string): string {
  if (code && DRAFT_ERROR_MESSAGES[code]) {
    return DRAFT_ERROR_MESSAGES[code];
  }
  return fallbackMessage || 'Có lỗi xảy ra khi xử lý bản nháp';
}

/**
 * Lấy chi tiết bản nháp theo id
 */
export async function getDraftDetail(id: string, baseUrl: string = getApiBaseUrl()): Promise<AiDraftDetail> {
  const res = await fetchWithAuth(`${baseUrl}/ai/drafts/${encodeURIComponent(id)}`);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Bản nháp không tồn tại hoặc bạn không có quyền truy cập');
    }
    throw new Error(`Không thể tải thông tin bản nháp (${res.status})`);
  }
  return res.json();
}

/**
 * Xác nhận bản nháp (Confirm)
 */
export async function confirmDraft(
  id: string,
  payload: Record<string, any>,
  baseUrl: string = getApiBaseUrl(),
): Promise<DraftConfirmResult> {
  const cleanPayload = stripDisplayFields(payload);
  const res = await fetchWithAuth(`${baseUrl}/ai/drafts/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ payload: cleanPayload }),
  });

  if (!res.ok) {
    let errData: DraftApiErrorResponse = {};
    try {
      errData = await res.json();
    } catch {
      // response không phải JSON
    }
    const message = getDraftErrorMessage(errData.code, errData.message);
    const error: any = new Error(message);
    error.status = res.status;
    error.code = errData.code;
    error.errors = errData.errors;
    throw error;
  }

  return res.json();
}

/**
 * Từ chối / Bỏ bản nháp (Reject)
 */
export async function rejectDraft(
  id: string,
  baseUrl: string = getApiBaseUrl(),
): Promise<{ status: string }> {
  const res = await fetchWithAuth(`${baseUrl}/ai/drafts/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
  });

  if (!res.ok) {
    let errData: DraftApiErrorResponse = {};
    try {
      errData = await res.json();
    } catch {
      // response không phải JSON
    }
    const message = getDraftErrorMessage(errData.code, errData.message);
    const error: any = new Error(message);
    error.status = res.status;
    error.code = errData.code;
    throw error;
  }

  return res.json();
}
