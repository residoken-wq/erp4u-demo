export type PermAction = 'view' | 'create' | 'update' | 'delete';

export const ACTION_COLUMN = {
  view: 'can_view',
  create: 'can_create',
  update: 'can_update',
  delete: 'can_delete',
} as const;

export interface PermissionModule {
  code: string;
  name: string;
  group: string;
}

// Thứ tự = thứ tự hiển thị trên màn hình phân quyền.
// P0 = đúng các mã UI đang có (kể cả PURCHASE, CMS dù backend chưa check) + SYSTEM (backend ZNS đã dùng).
// MARKETING chỉ được thêm ở P1, cùng lúc với seed dữ liệu.
export const PERMISSION_MODULES: PermissionModule[] = [
  { code: 'DASHBOARD', name: 'Tổng quan', group: 'Chung' },
  { code: 'PRODUCT', name: 'Quản lý Sản phẩm', group: 'Nghiệp vụ' },
  { code: 'SALES', name: 'Bán hàng (Sales/CRM)', group: 'Nghiệp vụ' },
  { code: 'INVENTORY', name: 'Kho & Tồn kho', group: 'Nghiệp vụ' },
  { code: 'PURCHASE', name: 'Mua hàng (PO)', group: 'Nghiệp vụ' },
  { code: 'PRODUCTION', name: 'Sản xuất (MRP)', group: 'Nghiệp vụ' },
  { code: 'FINANCE', name: 'Tài chính (Thu/Chi)', group: 'Nghiệp vụ' },
  { code: 'HR', name: 'Nhân sự (HR)', group: 'Nghiệp vụ' },
  { code: 'CMS', name: 'CMS Website', group: 'Website' },
  { code: 'USERS', name: 'Hệ thống & User', group: 'Quản trị' },
  { code: 'SYSTEM', name: 'Cấu hình tích hợp (SMTP, Hoá đơn, Vận chuyển, ZNS)', group: 'Quản trị' },
  // 6 mã FUP_* copy nguyên tên từ frontend/src/pages/UserGroupsPage.tsx:18-23 (FUP_SALES … FUP_OTHER), group: 'BOD FollowUp'
  { code: 'FUP_SALES', name: 'BOD FollowUp - Cột Sales (Chăm sóc, Giao hàng)', group: 'BOD FollowUp' },
  { code: 'FUP_PURCHASE', name: 'BOD FollowUp - Cột Mua hàng (NPL)', group: 'BOD FollowUp' },
  { code: 'FUP_PRODUCTION', name: 'BOD FollowUp - Cột Sản xuất (Sản xuất, Thiết kế...)', group: 'BOD FollowUp' },
  { code: 'FUP_ACCOUNTING', name: 'BOD FollowUp - Cột Công Nợ', group: 'BOD FollowUp' },
  { code: 'FUP_MEDIA', name: 'BOD FollowUp - Cột Chụp Mẫu (Media)', group: 'BOD FollowUp' },
  { code: 'FUP_OTHER', name: 'BOD FollowUp - Cột Ghi chú Khác', group: 'BOD FollowUp' },
];
