/**
 * Danh sách ngoại lệ tạm thời cho các route chưa phân loại (UNCLASSIFIED).
 * Mỗi mục ghi rõ method, path, và lý do chưa phân loại.
 * P12b sẽ hoàn thiện phân loại toàn bộ và làm rỗng danh sách này.
 */
export interface UnclassifiedRouteEntry {
  method: string;
  path: string;
  reason: string;
}

export const RBAC_UNCLASSIFIED_ALLOWLIST: UnclassifiedRouteEntry[] = [
  {
    method: 'GET',
    path: '/notifications',
    reason: 'Feed thông báo người dùng - chờ chuẩn hoá @AuthOnly hoặc quyền riêng trong P12b',
  },
  {
    method: 'POST',
    path: '/notifications/:id/read',
    reason: 'Đánh dấu đã đọc thông báo của người dùng - chờ chuẩn hoá @AuthOnly trong P12b',
  },
  {
    method: 'POST',
    path: '/notifications/read-all',
    reason: 'Đánh dấu đã đọc toàn bộ thông báo của người dùng - chờ chuẩn hoá @AuthOnly trong P12b',
  },
  {
    method: 'GET',
    path: '/proxy-image',
    reason: 'Proxy ảnh tải từ bên ngoài (P11a) trên AppController - chờ xác định @Public hay @AuthOnly trong P12b',
  },
  {
    method: 'GET',
    path: '/public/proxy-image',
    reason: 'Proxy ảnh tải từ bên ngoài (P11a) trên PublicController - chờ chuẩn hoá @Public trong P12b',
  },
];
