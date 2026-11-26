import { DEFAULT_COST_KEYS, DEFAULT_PURCHASE_COST_KEYS } from './cost-visibility.constants';

export interface StripCostOptions {
  canViewCost: boolean;
  canViewPurchaseCost?: boolean;
  costKeys?: readonly string[] | string[];
  purchaseKeys?: readonly string[] | string[];
}

/**
 * Đệ quy qua mảng, object lồng nhau, quan hệ để xoá các trường giá vốn/lợi nhuận
 * mà người gọi không có quyền xem.
 * Bảo toàn Date, Buffer, cấu trúc phân trang ({ data, total }).
 * Ngăn lặp vô hạn với WeakSet.
 */
export function stripCostFields<T>(
  data: T,
  options: StripCostOptions,
  seen = new WeakSet<object>(),
): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  // Preserve Date and Buffer instances
  if (data instanceof Date || (typeof Buffer !== 'undefined' && Buffer.isBuffer(data))) {
    return data;
  }

  if (seen.has(data as object)) {
    return data;
  }
  seen.add(data as object);

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      data[i] = stripCostFields(data[i], options, seen);
    }
    return data;
  }

  const { canViewCost, canViewPurchaseCost = canViewCost } = options;
  const costKeys = options.costKeys || DEFAULT_COST_KEYS;
  const purchaseKeys = options.purchaseKeys || [];

  // 1. Strip general cost keys if cannot view cost
  if (!canViewCost) {
    const isProduct = 'sku' in (data as any) || 'base_price' in (data as any);
    for (const key of costKeys) {
      if (key in (data as any)) {
        // Product's cost_price is strictly a product cost, never visible to non-cost viewers
        if (key === 'cost_price' && isProduct) {
          delete (data as any)[key];
          continue;
        }

        // If this key is also a purchaseKey and user CAN view purchase cost, do not delete
        if (purchaseKeys.includes(key) && canViewPurchaseCost) {
          continue;
        }
        delete (data as any)[key];
      }
    }
  }

  // 2. Strip purchase keys if cannot view purchase cost
  if (!canViewPurchaseCost) {
    for (const key of purchaseKeys) {
      if (key in (data as any)) {
        delete (data as any)[key];
      }
    }
  }

  // 3. Recurse down children
  for (const key of Object.keys(data as object)) {
    const val = (data as any)[key];
    if (val && typeof val === 'object') {
      (data as any)[key] = stripCostFields(val, options, seen);
    }
  }

  return data;
}

/**
 * Lọc bỏ các khoá giá vốn khỏi body request khi người dùng không có quyền ghi giá vốn.
 */
export function sanitizeWritePayload(
  body: any,
  options: {
    canViewCost: boolean;
    canViewPurchaseCost?: boolean;
    costKeys?: readonly string[] | string[];
    purchaseKeys?: readonly string[] | string[];
  },
): void {
  if (!body || typeof body !== 'object') return;

  const { canViewCost, canViewPurchaseCost = canViewCost } = options;
  const costKeys = options.costKeys || ['cost_price', 'profit_margin', 'new_cost_price'];
  const purchaseKeys = options.purchaseKeys || ['cost_per_unit', 'cost_price'];

  if (!canViewCost) {
    for (const key of costKeys) {
      if (key in body) {
        if (purchaseKeys.includes(key) && canViewPurchaseCost) {
          continue;
        }
        delete body[key];
      }
    }
  }

  if (!canViewPurchaseCost) {
    for (const key of purchaseKeys) {
      if (key in body) {
        delete body[key];
      }
    }
  }
}
