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

  /**
   * Hàm kiểm tra dòng chi phí thành phẩm/bán thành phẩm (nhận diện product cost line).
   * Dòng thoả mãn hàm này sẽ bị ẩn `unit_price`, `total_cost`, `total_amount` đối với người không có quyền `view_cost_price`,
   * kể cả khi họ có quyền xem giá mua NVL (`PURCHASE:can_view`).
   */
  productCostDetector?: (item: any) => boolean;
}

export const CostVisible = (options?: CostVisibleOptions): CustomDecorator<string> =>
  SetMetadata(COST_VISIBLE_METADATA, options || {});
