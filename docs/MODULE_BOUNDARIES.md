# Ranh Giới Module & Gói Tính Năng (Module Boundaries)

Tài liệu này quy định ranh giới phụ thuộc giữa các gói (package) trong kiến trúc **Modular Monolith** của ERP4U, nhằm đảm bảo các gói trả phí/add-on có thể bật/tắt độc lập và tách sang repository riêng khi cần mà không gây phụ thuộc chặt ở tầng database entity.

## 1. Quy tắc kiểm soát

Kiểm tra tự động bằng Jest test tại `src/common/packages/__tests__/module-boundaries.spec.ts` (chạy cùng `npm test` và `npx jest src/common/packages`).

- **Ánh xạ module → gói**: căn cứ theo `PACKAGE_MODULES` trong `src/common/packages/package.registry.ts`.
- **Cấm**: file trong module thuộc gói **A** import trực tiếp `*.entity` hoặc đường dẫn chứa `/entities/` của module thuộc gói **B** (với `A ≠ B` và `B ≠ CORE`).
- **Được phép**:
  - Import entity trong **cùng một gói** (ví dụ `production` import entity của `bom`).
  - Import entity thuộc gói **`CORE`** từ bất kỳ gói nào (ví dụ `products`, `customers`, `suppliers`, `users`, `categories`…).
  - Gọi nghiệp vụ liên gói thông qua **service được export trong `*.module.ts`** thay vì inject repository trực tiếp.
- **Các đường dẫn được miễn kiểm tra**:
  - `src/app.module.ts`: đăng ký toàn bộ TypeORM entity ở tầng root.
  - `src/database/seeds/**`: các script khởi tạo dữ liệu mẫu trên nhiều module.
  - `*.spec.ts`: file unit/integration test.

## 2. Cơ chế Baseline (chỉ được giảm, không được tăng)

Các vi phạm tồn đọng trước khi áp dụng ranh giới được ghi nhận trong `src/common/packages/module-boundaries.baseline.json` (định dạng `file → [import...]`).

- Khi xuất hiện **vi phạm mới ngoài baseline**: Jest test **FAIL** và hướng dẫn chuyển sang gọi qua service export trong `*.module.ts`.
- Khi một vi phạm cũ trong baseline **đã được gỡ bỏ**: Jest test in cảnh báo liệt kê dòng đã hết vi phạm để lập trình viên xoá khỏi `module-boundaries.baseline.json` (không làm fail CI).
- **Không sửa hàng loạt vi phạm baseline** trong cùng PR thêm tính năng — mỗi PR refactor sẽ thu nhỏ dần baseline cho đến khi bằng `0`.

## 3. Thống kê vi phạm baseline hiện tại theo cặp gói

Tổng số hiện tại: **118** lệnh import vi phạm trên **56** file (23 cặp gói).

| Gói nguồn (A) | Gói đích (B) | Số import vi phạm |
|---|---|---:|
| `PRODUCTION` | `INVENTORY` | 16 |
| `CORE` | `INVENTORY` | 15 |
| `MARKETING` | `SALES` | 11 |
| `CORE` | `PRODUCTION` | 10 |
| `INVENTORY` | `SALES` | 10 |
| `PRODUCTION` | `SALES` | 7 |
| `CORE` | `MARKETING` | 6 |
| `CORE` | `SALES` | 6 |
| `FINANCE` | `SALES` | 5 |
| `MARKETING` | `HR` | 5 |
| `INVENTORY` | `FINANCE` | 3 |
| `INVENTORY` | `PRODUCTION` | 3 |
| `PROJECTS` | `SALES` | 3 |
| `CORE` | `FINANCE` | 2 |
| `CORE` | `PROJECTS` | 2 |
| `DESIGN` | `INVENTORY` | 2 |
| `FINANCE` | `INVENTORY` | 2 |
| `INVENTORY` | `DESIGN` | 2 |
| `PROJECTS` | `FINANCE` | 2 |
| `PROJECTS` | `INVENTORY` | 2 |
| `SALES` | `FINANCE` | 2 |
| `DESIGN` | `SALES` | 1 |
| `SALES` | `PRODUCTION` | 1 |
| **Tổng cộng** | | **118** |

## 4. Cách thêm module mới đúng chuẩn

1. **Khai báo trong registry**: thêm tên thư mục module vào `PACKAGE_MODULES` tương ứng trong `src/common/packages/package.registry.ts` (và nếu tạo gói mới, cập nhật cả `PackageKey`, `PACKAGE_DEPENDENCIES` ở backend và `frontend/src/config/packages.ts` ở frontend).
2. **Gắn decorator entitlement cho controller**: mọi controller mới bắt buộc có `@RequiresPackage(PackageKey.<TEN_GOI>)` hoặc `@CorePackage()` — kiểm tra tự động bởi `src/common/packages/__tests__/controller-coverage.spec.ts`.
3. **Giao tiếp liên gói qua Service**:
   - Không import `*.entity` hoặc `/entities/` từ gói khác (trừ `CORE`).
   - Import NestJS module của gói đối tác (hoặc interface/service được export trong `*.module.ts`) và gọi method công khai thay vì `InjectRepository(...)` trực tiếp lên bảng của gói khác.
4. **Chạy kiểm tra trước khi tạo PR**:
   ```bash
   npx jest src/common/packages
   ```
