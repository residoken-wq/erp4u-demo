/**
 * Xử lý phiên đăng nhập hết hạn hoặc không hợp lệ (401).
 * Xoá token, thông tin người dùng và điều hướng về trang đăng nhập.
 */
export function handleUnauthorized(): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch {
      // Bỏ qua lỗi truy cập storage
    }
  }
  if (typeof window !== 'undefined' && window.location) {
    try {
      window.location.href = '/login';
    } catch {
      // Bỏ qua lỗi trong môi trường không có điều hướng
    }
  }
}
