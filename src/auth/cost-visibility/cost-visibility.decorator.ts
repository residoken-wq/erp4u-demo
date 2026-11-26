import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { COST_VISIBLE_METADATA } from './cost-visibility.constants';

export interface CostVisibleOptions {
  /**
   * Danh sách module quyết định quyền xem giá vốn.
   * Ví dụ: ['PRODUCT', 'PURCHASE', 'PRODUCTION', 'SALES', 'INVENTORY', 'FINANCE']
   */
  modules?: string[];

  /**
   * Danh sách khoá giá vốn / lợi nhuận tuỳ chỉnh cần lọc (nếu muốn bổ sung hoặc chỉ định riêng).
   */
  keys?: string[];

  /**
   * Các khoá giá mua nguyên vật liệu / nhà cung cấp (quy tắc PURCHASE).
   * Người có PURCHASE:can_view hoặc view_cost_price ở module route sẽ thấy các khoá này.
   */
  purchaseKeys?: string[];
}

export const CostVisible = (options?: CostVisibleOptions): CustomDecorator<string> =>
  SetMetadata(COST_VISIBLE_METADATA, options || {});
