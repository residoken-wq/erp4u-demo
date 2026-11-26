import { PERMISSION_MODULES } from './permission-catalog';

export interface GroupPermissionTemplate {
  module_code: string;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  view_cost_price?: boolean;
}

export interface DefaultGroupTemplate {
  name: string;
  description: string;
  permissions: GroupPermissionTemplate[];
}

/**
 * 7 mẫu nhóm quyền mặc định cho tenant mới (P12b2 D3).
 * Nguyên tắc: Quyền tối thiểu cần thiết cho công việc.
 * - Kinh doanh: SALES + PROJECTS
 * - Kho: INVENTORY
 * - Mua hàng: PURCHASE + xem PRODUCT
 * - Sản xuất: PRODUCTION + xem PRODUCT/INVENTORY
 * - Kế toán: FINANCE + xem SALES/PURCHASE
 * - Nhân sự: HR
 * - Mọi nhóm: DASHBOARD (can_view: true)
 * - Không ai ngoài Quản trị có USERS/SYSTEM.
 */
export const DEFAULT_GROUP_TEMPLATES: DefaultGroupTemplate[] = [
  {
    name: 'Quản trị',
    description: 'Toàn quyền quản trị hệ thống ERP4U',
    permissions: PERMISSION_MODULES.map((m) => ({
      module_code: m.code,
      can_view: true,
      can_create: true,
      can_update: true,
      can_delete: true,
      view_cost_price: true,
    })),
  },
  {
    name: 'Kinh doanh',
    description: 'Quản lý bán hàng, CRM và dự án',
    permissions: [
      { module_code: 'DASHBOARD', can_view: true, can_create: false, can_update: false, can_delete: false, view_cost_price: false },
      { module_code: 'SALES', can_view: true, can_create: true, can_update: true, can_delete: true, view_cost_price: false },
      { module_code: 'PROJECTS', can_view: true, can_create: true, can_update: true, can_delete: true, view_cost_price: false },
    ],
  },
  {
    name: 'Kho',
    description: 'Quản lý kho hàng, kiểm kê và xuất nhập tồn',
    permissions: [
      { module_code: 'DASHBOARD', can_view: true, can_create: false, can_update: false, can_delete: false, view_cost_price: false },
      { module_code: 'INVENTORY', can_view: true, can_create: true, can_update: true, can_delete: true, view_cost_price: false },
    ],
  },
  {
    name: 'Mua hàng',
    description: 'Quản lý mua hàng và nhà cung cấp',
    permissions: [
      { module_code: 'DASHBOARD', can_view: true, can_create: false, can_update: false, can_delete: false, view_cost_price: false },
      { module_code: 'PURCHASE', can_view: true, can_create: true, can_update: true, can_delete: true, view_cost_price: false },
      { module_code: 'PRODUCT', can_view: true, can_create: false, can_update: false, can_delete: false, view_cost_price: false },
    ],
  },
  {
    name: 'Sản xuất',
    description: 'Quản lý điều độ và kế hoạch sản xuất',
    permissions: [
      { module_code: 'DASHBOARD', can_view: true, can_create: false, can_update: false, can_delete: false, view_cost_price: false },
      { module_code: 'PRODUCTION', can_view: true, can_create: true, can_update: true, can_delete: true, view_cost_price: false },
      { module_code: 'PRODUCT', can_view: true, can_create: false, can_update: false, can_delete: false, view_cost_price: false },
      { module_code: 'INVENTORY', can_view: true, can_create: false, can_update: false, can_delete: false, view_cost_price: false },
    ],
  },
  {
    name: 'Kế toán',
    description: 'Quản lý tài chính, thu chi, hóa đơn và công nợ',
    permissions: [
      { module_code: 'DASHBOARD', can_view: true, can_create: false, can_update: false, can_delete: false, view_cost_price: true },
      { module_code: 'FINANCE', can_view: true, can_create: true, can_update: true, can_delete: true, view_cost_price: true },
      { module_code: 'SALES', can_view: true, can_create: false, can_update: false, can_delete: false, view_cost_price: true },
      { module_code: 'PURCHASE', can_view: true, can_create: false, can_update: false, can_delete: false, view_cost_price: true },
    ],
  },
  {
    name: 'Nhân sự',
    description: 'Quản lý nhân viên, chấm công và bảng lương',
    permissions: [
      { module_code: 'DASHBOARD', can_view: true, can_create: false, can_update: false, can_delete: false, view_cost_price: false },
      { module_code: 'HR', can_view: true, can_create: true, can_update: true, can_delete: true, view_cost_price: false },
    ],
  },
];
