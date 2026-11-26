import { DEFAULT_COST_KEYS, DEFAULT_PURCHASE_COST_KEYS } from './cost-visibility.constants';

export interface StripCostOptions {
  canViewCost: boolean;
  canViewPurchaseCost?: boolean;
  costKeys?: readonly string[] | string[];
  purchaseKeys?: readonly string[] | string[];
  productCostDetector?: (item: any) => boolean;
}

/**
 * Nhận diện dòng chi phí thành phẩm / bán thành phẩm (product cost line).
 * Trong PFO/Kế hoạch sản xuất, các dòng thành phẩm/BTP có đơn giá lấy từ giá vốn sản phẩm (prod.cost_price).
 * Các dòng này KHÔNG phải là dòng mua NVL hay dòng đơn mua hàng (PO item), và không phải dòng đơn bán (SO item).
 */
export function defaultProductCostDetector(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  // Dòng chi tiết đơn mua hàng (PO item) là giá mua/gia công thoả thuận với NCC
  if ('po_id' in item || 'purchase_order' in item) {
    return false;
  }
  // Dòng NVL (có material_id hoặc material relation) là chi phí mua NVL
  if (item.material_id || item.material) {
    return false;
  }
  // Dòng đơn bán (sales order item) không gắn pfo_id là giá bán khách hàng
  if (('sales_order_id' in item || 'order_id' in item || 'sales_order' in item || 'so_id' in item) && !('pfo_id' in item)) {
    return false;
  }
  // Dòng thành phẩm / bán thành phẩm (có product_id hoặc product relation)
  if (item.product_id || item.product) {
    return true;
  }
  return false;
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

  const { canViewCost, canViewPurchaseCost = canViewCost, productCostDetector } = options;
  const costKeys = options.costKeys || DEFAULT_COST_KEYS;
  const purchaseKeys = options.purchaseKeys || [];

  // Nhận diện dòng chi phí thành phẩm / BTP
  const isProdCostLine = productCostDetector ? productCostDetector(data) : false;

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
        // EXCEPT if this is a product cost line where purchase keys represent internal product cost
        if (purchaseKeys.includes(key) && canViewPurchaseCost && !isProdCostLine) {
          continue;
        }
        delete (data as any)[key];
      }
    }

    // Trên dòng thành phẩm/BTP (ví dụ PFO demand/requirements), đơn giá lấy từ giá vốn sản phẩm (prod.cost_price)
    // Ẩn unit_price, total_cost, total_amount khi người dùng không có view_cost_price
    if (isProdCostLine) {
      const prodCostKeysToStrip = ['unit_price', 'total_cost', 'total_amount'];
      for (const key of prodCostKeysToStrip) {
        if (key in (data as any)) {
          delete (data as any)[key];
        }
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
