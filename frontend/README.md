# ERP4U Frontend

## Tùy biến màu thương hiệu (Brand Colors)
Hệ thống sử dụng Conix Brand Guideline làm bảng màu mặc định. Để đổi màu thương hiệu cho instance tự host:
1. Mở file `src/theme/brand.ts` và chỉnh sửa các mã màu trong đối tượng `brandColors` (navy, orange, cream, mint...).
2. Đồng bộ các giá trị màu tương ứng trong `tailwind.config.js` và biến CSS trong `src/index.css`.
3. Chạy `npm run build` để đóng gói giao diện với bộ nhận diện thương hiệu mới.
