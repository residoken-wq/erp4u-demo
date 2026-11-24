/**
 * Pure functions and helpers for Alert Center (Task P9d1)
 */

export interface AlertSettingParamSpec {
  name: string;
  label: string;
  type: 'number';
  min: number;
  max: number;
  default: number;
  unit?: string;
  step?: number;
}

export const ALERT_SETTING_SPECS: Record<string, AlertSettingParamSpec[]> = {
  'stock.low_cover': [
    {
      name: 'threshold_days',
      label: 'Ngưỡng cảnh báo đủ hàng',
      type: 'number',
      min: 1,
      max: 90,
      default: 14,
      unit: 'ngày',
      step: 1,
    },
    {
      name: 'high_threshold_days',
      label: 'Ngưỡng cảnh báo mức cao',
      type: 'number',
      min: 1,
      max: 30,
      default: 7,
      unit: 'ngày',
      step: 1,
    },
    {
      name: 'history_days',
      label: 'Số ngày tính xuất bình quân',
      type: 'number',
      min: 7,
      max: 90,
      default: 30,
      unit: 'ngày',
      step: 1,
    },
  ],
  'order.at_risk': [
    {
      name: 'warning_days',
      label: 'Số ngày báo trước hạn giao',
      type: 'number',
      min: 1,
      max: 14,
      default: 3,
      unit: 'ngày',
      step: 1,
    },
  ],
  'receivable.overdue': [
    {
      name: 'min_overdue_days',
      label: 'Số ngày quá hạn tối thiểu',
      type: 'number',
      min: 7,
      max: 180,
      default: 30,
      unit: 'ngày',
      step: 1,
    },
    {
      name: 'min_amount',
      label: 'Số tiền nợ tối thiểu',
      type: 'number',
      min: 0,
      max: 100000000,
      default: 100000,
      unit: '₫',
      step: 10000,
    },
  ],
  'cash.anomaly': [
    {
      name: 'category_surge_percent',
      label: 'Tỉ lệ chi tăng vọt danh mục',
      type: 'number',
      min: 10,
      max: 200,
      default: 50,
      unit: '%',
      step: 5,
    },
    {
      name: 'category_min_diff',
      label: 'Chênh lệch chi tối thiểu',
      type: 'number',
      min: 500000,
      max: 50000000,
      default: 5000000,
      unit: '₫',
      step: 500000,
    },
    {
      name: 'outlier_multiplier',
      label: 'Bội số giao dịch đột biến (so với trung vị)',
      type: 'number',
      min: 1.5,
      max: 10,
      default: 3.0,
      unit: 'lần',
      step: 0.5,
    },
    {
      name: 'outlier_min_tx_count',
      label: 'Số giao dịch tối thiểu để xét trung vị',
      type: 'number',
      min: 3,
      max: 50,
      default: 10,
      unit: 'giao dịch',
      step: 1,
    },
  ],
};

/**
 * Lấy nhãn tiếng Việt của loại cảnh báo
 */
export function getAlertTypeLabel(type?: string | null): string {
  if (!type) return 'Không xác định';
  switch (type) {
    case 'stock.low_cover':
      return 'Tồn kho thấp';
    case 'order.at_risk':
      return 'Đơn hàng trễ hạn';
    case 'receivable.overdue':
      return 'Công nợ quá hạn';
    case 'cash.anomaly':
      return 'Biến động chi phí';
    default:
      return type;
  }
}

/**
 * Lấy màu trạng thái và nhãn cho mức độ cảnh báo (KHÔNG dùng cam thương hiệu cho lỗi)
 */
export function getAlertSeverityInfo(severity?: string | null): {
  label: string;
  color: string;
  badgeStatus: 'error' | 'warning' | 'processing' | 'default';
  tagColor: string;
} {
  switch (severity) {
    case 'high':
      // Màu đỏ tiêu chuẩn cho lỗi/nguy hiểm - không dùng cam thương hiệu
      return {
        label: 'Cao',
        color: '#ff4d4f',
        badgeStatus: 'error',
        tagColor: 'error',
      };
    case 'medium':
      return {
        label: 'Trung bình',
        color: '#faad14',
        badgeStatus: 'warning',
        tagColor: 'warning',
      };
    case 'low':
      return {
        label: 'Thấp',
        color: '#1677ff',
        badgeStatus: 'processing',
        tagColor: 'processing',
      };
    default:
      return {
        label: severity || 'N/A',
        color: '#8c8c8c',
        badgeStatus: 'default',
        tagColor: 'default',
      };
  }
}

/**
 * Lấy nhãn và màu cho trạng thái cảnh báo
 */
export function getAlertStatusInfo(status?: string | null): {
  label: string;
  tagColor: string;
} {
  switch (status) {
    case 'open':
      return { label: 'Đang mở', tagColor: 'red' };
    case 'acknowledged':
      return { label: 'Đã xem', tagColor: 'blue' };
    case 'snoozed':
      return { label: 'Tạm ẩn', tagColor: 'orange' };
    case 'resolved':
      return { label: 'Đã xử lý', tagColor: 'green' };
    default:
      return { label: status || 'N/A', tagColor: 'default' };
  }
}

/**
 * Định dạng tiền tệ VNĐ
 */
export function formatCurrencyVND(amount?: number | null): string {
  const num = Number(amount) || 0;
  return num.toLocaleString('vi-VN') + ' ₫';
}

/**
 * Dựng chuỗi hiển thị số liệu chính từ `detail` theo từng type
 */
export function formatAlertMetrics(type: string, detail?: Record<string, any> | null): string {
  if (!detail) return '-';

  switch (type) {
    case 'stock.low_cover': {
      const avail = detail.available !== undefined ? detail.available : '-';
      const avg = detail.avg_daily_out !== undefined ? detail.avg_daily_out : '-';
      const days = detail.days_of_cover !== undefined ? detail.days_of_cover : '-';
      const threshold = detail.threshold_days || 14;
      return `Tồn khả dụng: ${avail} | Xuất TB: ${avg}/ngày | Đủ dùng: ${days} ngày (ngưỡng ${threshold} ngày)`;
    }

    case 'order.at_risk': {
      const delivery = detail.delivery_date || '-';
      const days = detail.days_until_delivery;
      let timingStr = '';
      if (typeof days === 'number') {
        timingStr = days < 0 ? `Quá hạn ${Math.abs(days)} ngày` : `Còn ${days} ngày`;
      }
      const moStr = detail.production_order_code ? ` | Lệnh SX: ${detail.production_order_code}` : '';
      return `Hẹn giao: ${delivery}${timingStr ? ` (${timingStr})` : ''}${moStr}`;
    }

    case 'receivable.overdue': {
      const remaining = formatCurrencyVND(detail.remaining_amount);
      const total = formatCurrencyVND(detail.total_amount);
      const days = detail.overdue_days !== undefined ? `${detail.overdue_days} ngày` : '-';
      const bracket = detail.aging_bracket === '90_plus' ? '90+ ngày' : detail.aging_bracket ? `${detail.aging_bracket} ngày` : '';
      return `Còn nợ: ${remaining} / ${total} | Quá hạn: ${days}${bracket ? ` (Nhóm: ${bracket})` : ''}`;
    }

    case 'cash.anomaly': {
      const current = formatCurrencyVND(detail.current_amount);
      const baseline = formatCurrencyVND(detail.baseline_amount);
      const diff = formatCurrencyVND(detail.diff_amount);
      const ratio = detail.ratio ? `${Number(detail.ratio).toFixed(1)}x` : '';
      if (detail.sub_type === 'single_outlier') {
        return `Giao dịch đột biến: ${current} (gấp ${ratio} trung vị ${baseline}, chênh +${diff})`;
      }
      return `Chi trong tháng: ${current} (tăng ${ratio} so với TB ${baseline}, chênh +${diff})`;
    }

    default:
      return JSON.stringify(detail);
  }
}

/**
 * Kiểm tra đường dẫn mở chứng từ hợp lệ:
 * - Bắt đầu bằng `/`
 * - Không bắt đầu bằng `//` (ngăn Open Redirect)
 * - Không chứa `\`
 * - Không chứa giao thức bên ngoài như `http:`, `https:`, `javascript:`, `data:`
 */
export function isValidAlertPath(path?: string | null): boolean {
  if (!path || typeof path !== 'string') return false;
  const trimmed = path.trim();

  // Bắt buộc bắt đầu bằng '/'
  if (!trimmed.startsWith('/')) return false;

  // Ngăn //evil.com
  if (trimmed.startsWith('//')) return false;

  // Ngăn dấu gạch chéo ngược
  if (trimmed.includes('\\')) return false;

  // Ngăn giao thức URL trước dấu '?' hoặc '#'
  const pathWithoutQuery = trimmed.split(/[?#]/)[0];
  if (pathWithoutQuery.includes(':')) return false;

  return true;
}

/**
 * Ánh xạ entity_type và entity_id sang route nội bộ
 */
export function getEntityRoute(entityType?: string | null, _entityId?: string | number | null): string {
  switch (entityType) {
    case 'product':
      return '/products';
    case 'material':
      return '/materials';
    case 'sales_order':
      return '/orders';
    case 'production_order':
      return '/planning';
    case 'transaction':
    case 'transaction_category':
      return '/finance';
    default:
      return '/alerts';
  }
}

/**
 * Dựng câu hỏi chuẩn cho Copilot từ alertId
 */
export function buildCopilotAlertQuestion(alertId: string | number): string {
  return `Phân tích cảnh báo #${alertId} và gợi ý cách xử lý`;
}

/**
 * Validate cấu hình tham số settings của từng loại cảnh báo theo min/max
 */
export function validateAlertSettingParams(
  type: string,
  params: Record<string, any>,
): { valid: boolean; errors: Record<string, string> } {
  const specs = ALERT_SETTING_SPECS[type] || [];
  const errors: Record<string, string> = {};

  for (const spec of specs) {
    const val = params[spec.name];
    if (val === undefined || val === null || val === '') {
      errors[spec.name] = `${spec.label} không được để trống`;
      continue;
    }

    const num = Number(val);
    if (isNaN(num)) {
      errors[spec.name] = `${spec.label} phải là số hợp lệ`;
      continue;
    }

    if (num < spec.min) {
      errors[spec.name] = `${spec.label} không được nhỏ hơn ${spec.min} ${spec.unit || ''}`.trim();
    } else if (num > spec.max) {
      errors[spec.name] = `${spec.label} không được vượt quá ${spec.max} ${spec.unit || ''}`.trim();
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
