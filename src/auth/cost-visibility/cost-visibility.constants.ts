export const COST_VISIBLE_METADATA = 'COST_VISIBLE_METADATA';

/**
 * Danh sách các khoá giá vốn / lợi nhuận mặc định cần lọc khi người dùng không có quyền xem giá vốn.
 * KHÔNG xoá các trường giá bán (base_price, unit_price của đơn bán, website_price).
 */
export const DEFAULT_COST_KEYS: readonly string[] = [
  'cost_price',
  'profit_margin',
  'cost_per_unit',
  'total_cost',
  'cogs',
  'totalCogs',
  'gross_profit',
  'profit',
  'margin',
  'new_cost_price',
  'old_cost_price',
  'total_actual_cost',
  'total_estimated_cost',
  'actual_cost',
  'estimated_cost',
  'expected_bom_cost',
  'expected_routing_cost',
  'expected_logistic_cost',
  'expected_stock_cost',
  'totalExpectedCost',
  'expectedProfit',
  'expected_profit',
  'so_profit',
  'totalNplCost',
];

/**
 * Các khoá giá mua nguyên vật liệu / nhà cung cấp.
 * Hiển thị khi người gọi có PURCHASE:can_view HOẶC có view_cost_price ở route module.
 */
export const DEFAULT_PURCHASE_COST_KEYS: readonly string[] = [
  'cost_per_unit',
  'cost_price',
  'price',
];
