/**
 * Định nghĩa route và các hàm thuần tiện ích cho Nháp AI (P9c1)
 */

export const DRAFT_KIND_LABELS: Record<string, string> = {
  quotation: 'Báo giá',
  purchase_order: 'Đơn mua hàng',
  production_order: 'Lệnh sản xuất',
  task: 'Công việc',
  lead: 'Khách tiềm năng',
  email: 'Email',
};

export const DRAFT_ROUTES: Record<string, (id: string) => string> = {
  quotation: (id: string) => `/sales?aiDraft=${encodeURIComponent(id)}`,
  purchase_order: (id: string) => `/purchasing?aiDraft=${encodeURIComponent(id)}`,
  production_order: (id: string) => `/planning?aiDraft=${encodeURIComponent(id)}`,
  task: (id: string) => `/tasks?aiDraft=${encodeURIComponent(id)}`,
  lead: (id: string) => `/customers?aiDraft=${encodeURIComponent(id)}`,
  email: (id: string) => `/customers?aiDraft=${encodeURIComponent(id)}`,
};

/**
 * Trả về route form tương ứng với loại nháp và id.
 * Trả về null nếu kind lạ hoặc không được hỗ trợ -> Thẻ nháp không hiển thị nút mở.
 */
export function getDraftRoute(kind?: string | null, draftId?: string | null): string | null {
  if (!kind || !draftId) return null;
  const routeBuilder = DRAFT_ROUTES[kind];
  if (!routeBuilder) return null;
  return routeBuilder(draftId);
}

/**
 * Lấy nhãn tiếng Việt cho loại nháp.
 */
export function getDraftKindLabel(kind?: string | null): string {
  if (!kind) return 'Nháp';
  return DRAFT_KIND_LABELS[kind] || kind;
}

/**
 * Lấy thông tin nhãn & màu sắc theo trạng thái nháp.
 */
export function getDraftStatusInfo(status?: string | null): { label: string; color: string } {
  switch (status) {
    case 'pending':
      return { label: 'Chờ duyệt', color: 'orange' };
    case 'confirmed':
      return { label: 'Đã tạo', color: 'green' };
    case 'rejected':
      return { label: 'Đã bỏ', color: 'default' };
    case 'expired':
      return { label: 'Hết hạn', color: 'red' };
    case 'failed':
      return { label: 'Lỗi', color: 'red' };
    case 'executing':
      return { label: 'Đang xử lý', color: 'blue' };
    default:
      return { label: status || 'Không rõ', color: 'default' };
  }
}

/**
 * Lọc bỏ trường `_display` (chỉ hiển thị) khỏi payload trước khi gửi confirm.
 * Xử lý đệ quy cho object lồng nhau và mảng đối tượng.
 */
export function stripDisplayFields<T = any>(val: T): T {
  if (val === null || val === undefined) {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => stripDisplayFields(item)) as unknown as T;
  }
  if (typeof val === 'object' && !(val instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (k === '_display' || k.startsWith('_display')) {
        continue;
      }
      cleaned[k] = stripDisplayFields(v);
    }
    return cleaned as T;
  }
  return val;
}

export interface ValidationErrorItem {
  field: string;
  message: string;
}

export interface MappedFieldValidation {
  name: (string | number)[];
  errors: string[];
}

/**
 * Chuyển đổi mảng lỗi validate DRAFT_INVALID từ backend:
 * Hỗ trợ đường dẫn dạng dấu chấm (vd: 'items.0.quantity' -> name: ['items', 0, 'quantity'])
 * Trả về danh sách fieldErrors cho Ant Design Form (`form.setFields(fieldErrors)`)
 * và errorMap cho tra cứu trực tiếp theo chuỗi field.
 */
export function mapDraftValidationErrors(errors?: ValidationErrorItem[] | null): {
  fieldErrors: MappedFieldValidation[];
  errorMap: Record<string, string>;
} {
  const fieldErrors: MappedFieldValidation[] = [];
  const errorMap: Record<string, string> = {};

  if (!Array.isArray(errors) || errors.length === 0) {
    return { fieldErrors, errorMap };
  }

  for (const err of errors) {
    if (!err || typeof err.field !== 'string') continue;
    errorMap[err.field] = err.message;

    // Phân rã chuỗi đường dẫn trường (vd: 'items.0.quantity' -> ['items', 0, 'quantity'])
    const parts = err.field.split('.').map((part) => {
      const num = Number(part);
      return !isNaN(num) && /^\d+$/.test(part) ? num : part;
    });

    fieldErrors.push({
      name: parts,
      errors: [err.message],
    });
  }

  return { fieldErrors, errorMap };
}
