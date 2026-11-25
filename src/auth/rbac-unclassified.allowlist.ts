/**
 * Danh sách ngoại lệ tạm thời cho các route chưa phân loại (UNCLASSIFIED).
 * P12b1 đã hoàn thiện phân loại toàn bộ route, danh sách này giữ rỗng.
 */
export interface UnclassifiedRouteEntry {
  method: string;
  path: string;
  reason: string;
}

export const RBAC_UNCLASSIFIED_ALLOWLIST: UnclassifiedRouteEntry[] = [];
