# Tài Liệu Vận Hành & Ma Trận Phân Quyền Hệ Thống (RBAC Matrix)

Tài liệu này hướng dẫn quản trị viên và đội ngũ vận hành hệ thống ERP4U về ma trận phân quyền dựa trên vai trò (Role-Based Access Control - RBAC), danh mục API màn hình chính, các endpoint đặc biệt và cách quản lý chế độ thực thi (ENFORCE/SHADOW).

---

## 1. Ma Trận Phân Quyền: Module × 7 Nhóm Mẫu

ERP4U định nghĩa 7 nhóm người dùng chuẩn cho tenant mới theo nguyên tắc **Quyền tối thiểu cần thiết cho công việc** (*Least Privilege*).

### Bảng Ký Hiệu:
- **V** = `can_view` (Xem)
- **C** = `can_create` (Tạo mới)
- **U** = `can_update` (Chỉnh sửa)
- **D** = `can_delete` (Xoá)
- **$** = `view_cost_price` (Xem giá vốn)
- **-** = Không có quyền (truy cập bị chặn 403 ở chế độ ENFORCE)

| Mã Module | Tên Module | Quản trị | Kinh doanh | Kho | Mua hàng | Sản xuất | Kế toán | Nhân sự |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **DASHBOARD** | Tổng quan | V,C,U,D,$ | **V** | **V** | **V** | **V** | **V** | **V** |
| **SALES** | Bán hàng & CRM | V,C,U,D,$ | **V,C,U,D** | - | - | - | **V,$** | - |
| **PROJECTS** | Dự án | V,C,U,D,$ | **V,C,U,D** | - | - | - | - | - |
| **INVENTORY** | Kho & Tồn kho | V,C,U,D,$ | - | **V,C,U,D** | - | **V** | - | - |
| **PURCHASE** | Mua hàng (PO) | V,C,U,D,$ | - | - | **V,C,U,D** | - | **V,$** | - |
| **PRODUCT** | Quản lý Sản phẩm | V,C,U,D,$ | - | - | **V** | **V** | - | - |
| **PRODUCTION** | Sản xuất (MRP) | V,C,U,D,$ | - | - | - | **V,C,U,D** | - | - |
| **FINANCE** | Tài chính (Thu/Chi) | V,C,U,D,$ | - | - | - | - | **V,C,U,D,$** | - |
| **HR** | Nhân sự (HR) | V,C,U,D,$ | - | - | - | - | - | **V,C,U,D** |
| **USERS** | Quản trị Người dùng | V,C,U,D,$ | - | - | - | - | - | - |
| **SYSTEM** | Cấu hình Hệ thống | V,C,U,D,$ | - | - | - | - | - | - |
| **MARKETING** | Marketing & Social | V,C,U,D,$ | - | - | - | - | - | - |
| **CMS** | Website CMS | V,C,U,D,$ | - | - | - | - | - | - |
| **CHATBOT** | Trợ lý AI CSKH | V,C,U,D,$ | - | - | - | - | - | - |
| **CHATBOT_KB** | Tri thức AI | V,C,U,D,$ | - | - | - | - | - | - |
| **FUP_*** | BOD FollowUp | V,C,U,D,$ | - | - | - | - | - | - |

> [!NOTE]
> - Chỉ duy nhất nhóm **Quản trị** được phân quyền module `USERS` và `SYSTEM`.
> - Nhóm **Kinh doanh** có toàn quyền trên `SALES` và `PROJECTS`.
> - Nhóm **Kho** quản lý tồn kho `INVENTORY`.
> - Nhóm **Mua hàng** có quyền tạo PO (`PURCHASE`) và xem danh mục sản phẩm (`PRODUCT:view`).
> - Nhóm **Sản xuất** điều độ sản xuất (`PRODUCTION`) và xem danh mục sản phẩm/kho (`PRODUCT:view`, `INVENTORY:view`).
> - Nhóm **Kế toán** có toàn quyền trên `FINANCE` kèm quyền xem giá vốn, đồng thời được xem đơn bán hàng (`SALES:view`) và đơn mua hàng (`PURCHASE:view`) để phục vụ đối soát công nợ.
> - Nhóm **Nhân sự** phụ trách quản lý hồ sơ nhân sự, bảng lương và chấm công (`HR`).

---

## 2. Danh Sách API Màn Hình Chính Theo Module & Xử Lý Quyền

Khi người dùng mở một màn hình trên giao diện, frontend sẽ gọi một tập hợp các API. Ở chế độ ENFORCE, **toàn bộ các API chạy khi mở màn hình của nhóm mình và các trang chung đều phải trả về HTTP 200** (không được xuất hiện lỗi 403 Forbidden hoặc làm hiện thông báo toast 403).

### 2.1. Chi Tiết Màn Hình → API → Quyền Cần → Kết Quả ở ENFORCE

| Màn hình & Nhóm | Tuyến Đường (API Route) | Quyền Cần / Cơ Chế | Kết Quả ENFORCE |
|---|---|---|:---:|
| **Trang chung mọi nhóm**<br>(`App.tsx`, `Header`, `DashboardPage`, `TasksPage`) | `GET /auth/me`<br>`GET /notifications`<br>`GET /announcements/user/active`<br>`GET /discussions`<br>`GET /system/dashboard/stats`<br>`GET /tasks`<br>`GET /lookups/users`<br>`GET /lookups/projects` | `@AuthOnly()`<br>`@AuthOnly()`<br>`@AuthOnly()`<br>`@AuthOnly()`<br>`DASHBOARD:view`<br>`@AuthOnly()`<br>`@AuthOnly()`<br>`@AuthOnly()` | **200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK** |
| **Kinh doanh**<br>(`SalesPage`, `CustomersPage`, `CrmPage`, `ProjectsPage`, `ProjectDetailPage`) | `GET /sales`<br>`GET /sales/:id` (hoặc `:order_code`)<br>`GET /customers`<br>`GET /customers/:id`<br>`GET /customers/:id/orders`<br>`GET /projects`<br>`GET /projects/:id`<br>`GET /projects/:id/cost-summary`<br>`GET /products`<br>`GET /system/company`<br>`GET /system/templates` | `SALES:view`<br>`SALES:view`<br>`SALES:view`<br>`SALES:view`<br>`SALES:view`<br>`PROJECTS:view`<br>`PROJECTS:view`<br>`PROJECTS:view`<br>`@AnyPerm(PRODUCT, SALES, ...)`<br>`@Public()`<br>`@AnyPerm(SYSTEM, SALES)` | **200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK** |
| **Kho**<br>(`InventoryPage`) | `GET /inventory/stocks`<br>`GET /inventory/history`<br>`GET /inventory/goods-receipt/pending`<br>`GET /inventory/deliveries/pending`<br>`GET /inventory/deliveries/completed`<br>`GET /inventory/shipping-carriers`<br>`GET /inventory/goods-issue`<br>`GET /materials`<br>`GET /lookups/products`<br>`GET /lookups/suppliers` | `INVENTORY:view`<br>`INVENTORY:view`<br>`INVENTORY:view`<br>`INVENTORY:view`<br>`INVENTORY:view`<br>`INVENTORY:view`<br>`INVENTORY:view`<br>`INVENTORY:view`<br>`@AuthOnly()` (đổi từ `/products`)<br>`@AuthOnly()` | **200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK** |
| **Mua hàng**<br>(`PurchasingPage`) | `GET /purchasing`<br>`GET /purchasing/:id`<br>`GET /purchasing/available-for-pooling`<br>`GET /purchasing/pooled/:id/aggregate`<br>`GET /inventory/goods-receipt/po/:id`<br>`GET /planning/pfo/:id`<br>`GET /products`<br>`GET /system/company`<br>`GET /lookups/suppliers`<br>`GET /lookups/projects` | `PURCHASE:view`<br>`PURCHASE:view`<br>`PURCHASE:view`<br>`PURCHASE:view`<br>`@AnyPerm(INVENTORY, PURCHASE)`<br>`@AnyPerm(PRODUCTION, PURCHASE)`<br>`PRODUCT:view`<br>`@Public()`<br>`@AuthOnly()`<br>`@AuthOnly()` | **200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK** |
| **Sản xuất**<br>(`PlanningPage`, `ProductionDashboardPage`, `ProductionRoutePage`) | `GET /planning`<br>`GET /planning/pfo/suggestions`<br>`GET /planning/pfo/:id`<br>`GET /planning/pfo/:id/pos`<br>`GET /planning/pfo/:id/pxks`<br>`GET /planning/pfo/:id/preview-btp`<br>`GET /production/assignments`<br>`GET /qc/summary`<br>`GET /products`<br>`GET /products/:id/routings`<br>`GET /products/calculate-cost/:sku`<br>`GET /inventory/stocks`<br>`GET /materials` | `PRODUCTION:view`<br>`PRODUCTION:view`<br>`PRODUCTION:view`<br>`PRODUCTION:view`<br>`PRODUCTION:view`<br>`PRODUCTION:view`<br>`PRODUCTION:view`<br>`PRODUCTION:view`<br>`PRODUCT:view`<br>`@AnyPerm(PRODUCT, PRODUCTION, ...)`<br>`@AnyPerm(PRODUCT, PRODUCTION)`<br>`INVENTORY:view`<br>`INVENTORY:view` | **200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK** |
| **Kế toán**<br>(`FinancePage`) | `GET /finance/transactions`<br>`GET /finance/categories`<br>`GET /finance/summary`<br>`GET /finance/so-profit`<br>`GET /sales`<br>`GET /sales/:id`<br>`GET /purchasing`<br>`GET /purchasing/:id`<br>`GET /lookups/customers`<br>`GET /lookups/suppliers`<br>`GET /lookups/projects` | `FINANCE:view`<br>`FINANCE:view`<br>`FINANCE:view`<br>`FINANCE:view`<br>`SALES:view`<br>`SALES:view`<br>`PURCHASE:view`<br>`PURCHASE:view`<br>`@AuthOnly()`<br>`@AuthOnly()`<br>`@AuthOnly()` | **200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK** |
| **Nhân sự**<br>(`HRPage`, `EmployeesTab`) | `GET /hr/employees`<br>`GET /hr/attendances`<br>`GET /hr/leaves`<br>`GET /hr/shifts`<br>`GET /hr/assets`<br>`GET /hr/payslips`<br>`GET /hr/trainings`<br>`GET /hr/balance/:employeeId`<br>`GET /hr/me/reviews`<br>`GET /hr/recruitment/jobs`<br>`GET /hr/recruitment/candidates`<br>`GET /hr/recruitment/interviews`<br>`GET /hr/review-questions`<br>`GET /hr/review-campaigns`<br>`GET /lookups/users`<br>`GET /lookups/employees` | `HR:view`<br>`HR:view`<br>`HR:view`<br>`HR:view`<br>`HR:view`<br>`HR:view`<br>`HR:view`<br>`HR:view`<br>`@AuthOnly()`<br>`HR:view`<br>`HR:view`<br>`HR:view`<br>`HR:view`<br>`HR:view`<br>`@AuthOnly()`<br>`@AuthOnly()` | **200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK**<br>**200 OK** |
| **Quản trị**<br>(`UsersPage`, `UserGroupsPage`, `SystemSettingsPage`, toàn hệ thống) | `GET /users`<br>`GET /users/groups`<br>`GET /users/online`<br>`GET /auth/rbac/mode`<br>`GET /auth/rbac/readiness`<br>+ Toàn bộ endpoint của các module trên | `USERS:view`<br>`USERS:view`<br>`USERS:view`<br>`SYSTEM:view`<br>`SYSTEM:view`<br>`admin` hoặc full quyền mẫu Quản trị | **200 OK** |

### 2.2. Bảng Xử Lý Các Điểm Nghẽn Phân Quyền Khi Mở Màn Hình (P12b2-r2)

| Endpoint | Nhóm Bị 403 | Nguyên Nhân | Cách Xử Lý Theo Thứ Tự Ưu Tiên |
|---|---|---|---|
| `GET /inventory/goods-receipt/po/:id` | Mua hàng | Trước đây chỉ cho `INVENTORY:view`; nhân viên Mua hàng khi xem tiến độ đơn PO cần biết danh sách phiếu nhập kho tương ứng. | **Ưu tiên 2 (@AnyPerm)**: Bổ sung `@RequireAnyPermission(['INVENTORY', 'can_view'], ['PURCHASE', 'can_view'])` và `@AnyPerm(['INVENTORY', 'view'], ['PURCHASE', 'view'])`. Endpoint chỉ trả mã PNK và số lượng nhận, không lộ giá vốn/lương/công nợ. |
| `GET /planning/pfo/:id` | Mua hàng | Trước đây chỉ cho `PRODUCTION:view`; nhân viên Mua hàng khi duyệt PO cần xem nhu cầu NPL và sản phẩm kế hoạch liên quan. | **Ưu tiên 2 (@AnyPerm)**: Bổ sung `@AnyPerm(['PRODUCTION', 'view'], ['PURCHASE', 'view'])` cho `getPfoDetails`. Không lộ lương hoặc công nợ. |
| `GET /products/:id/routings`<br>`GET /products/calculate-cost/:sku` | Sản xuất | Controller có `PermissionsGuard`, trước đây thiếu `@RequireAnyPermission` tương ứng với `@AnyPerm`. | **Ưu tiên 2 (@AnyPerm & @RequireAnyPermission)**: Bổ sung `@RequireAnyPermission` đồng bộ với `@AnyPerm` cho `PRODUCT` và `PRODUCTION`. |
| `GET /products` | Kho | `InventoryPage` gọi `/products` chỉ để lấy `{ id, sku, name, unit }` làm dữ liệu chọn dropdown và kiểm tra mã; nếu mở quyền `/products` cho Kho sẽ lộ `cost_price` (giá vốn). | **Ưu tiên 1 (Dữ liệu tra cứu sang /lookups/*)**: Chuyển lời gọi trong `InventoryPage` sang `GET /lookups/products`, vừa đáp ứng trọn vẹn nghiệp vụ vừa tuyệt đối bảo mật giá vốn. |
| `GET /purchasing`<br>`GET /planning` | Kho | `InventoryPage` gọi cả danh sách PO và PFO trong `fetchData` ban đầu để phục vụ modal sửa phiếu xuất NPL (trường hợp hiếm). | **Ưu tiên 4 (Lời gọi phụ không thiết yếu)**: Kiểm tra `canViewPurchasing` / `canViewPlanning` qua `usePermission` trước khi gọi. Người chỉ có quyền Kho sẽ không gọi 2 API này khi mở trang, ngăn chặn triệt để toast 403. |
| `GET /purchasing` | Sản xuất | `ProductionDashboardPage` gọi `/purchasing` để tính thống kê PO gia công/NPL; tài khoản chỉ có quyền Sản xuất bị 403. | **Ưu tiên 4 (Lời gọi phụ không thiết yếu)**: Kiểm tra `usePermission('PURCHASE')` trước khi gọi `/purchasing`. Nếu không có quyền mua hàng, tự động bỏ qua và hiển thị danh sách rỗng, không gây lỗi 403. |
| `GET /system/logs?limit=5`<br>`GET /customers?type=LEAD...` | Kho, Mua hàng, Sản xuất, Kế toán, Nhân sự | `DashboardPage` gọi 2 API này không qua kiểm tra quyền, dẫn đến người dùng không có `USERS` hoặc `SALES` bị 403 ngay khi vào trang chủ. | **Ưu tiên 4 (Lời gọi phụ không thiết yếu)**: Dùng `hasPerm('USERS')` và `hasPerm('SALES')` chặn không gọi request khi thiếu quyền; giao diện hiển thị trạng thái an toàn không có dữ liệu mà không văng toast 403. |
| `GET /designs/print-designs` | Mua hàng | `PurchasingPage` gọi endpoint này trong khi package DESIGN là module mở rộng pluggable không có sẵn trong core. | **Ưu tiên 4 (Lời gọi phụ không thiết yếu)**: Kiểm tra `usePermission('DESIGN')` trước khi gọi và xử lý `.catch()` an toàn. |

---

## 3. Các Tuyến Đường (Route) AUTH-Only Đặc Biệt

Để tránh việc người dùng bị chặn 403 khi thao tác các tính năng dùng chung hoặc dữ liệu cá nhân, hệ thống thiết kế các nhóm endpoint AUTH-only đặc biệt:

### 3.1. Endpoint Tra Cứu Tối Giản (`/lookups/*`)
Tất cả endpoint tra cứu thuộc tầng `@AuthOnly()`, chỉ yêu cầu đăng nhập hợp lệ. Chúng **chỉ trả về `id` và tên/mã hiển thị**, lọc bỏ hoàn toàn các trường nhạy cảm (giá vốn, công nợ, lương, mật khẩu, IP):
- `GET /lookups/users`: Trả về `{ id, full_name }` (dùng để chọn người phụ trách, phân công).
- `GET /lookups/products`: Trả về `{ id, sku, name, unit }` (dùng cho đơn mua hàng, BOM sản xuất).
- `GET /lookups/customers`: Trả về `{ id, code, name }` (dùng cho chứng từ thu chi, dự án).
- `GET /lookups/suppliers`: Trả về `{ id, code, name }` (dùng cho đơn mua hàng, kho hàng).
- `GET /lookups/warehouses`: Trả về danh sách kho `{ id, name }`.
- `GET /lookups/employees`: Trả về `{ id, code, full_name }` (dùng cho nhân sự, phân công).
- `GET /lookups/projects`: Trả về `{ id, name, code, status }` (dùng cho phiếu thu chi, đơn PO).
- `GET /lookups/project-tasks?project_id=...`: Trả về `{ id, title }`.

### 3.2. HR Tự Phục Vụ (`selfOr` Mechanism)
Nhân viên bình thường **không có quyền module `HR`** vẫn có quyền tra cứu thông tin của chính mình thông qua cơ chế `selfOr`:
- `GET /hr/me/attendances`: Lịch sử chấm công của bản thân.
- `GET /hr/me/payslips`: Danh sách phiếu lương của bản thân.
- `GET /hr/me/payslips/:id`: Chi tiết phiếu lương của bản thân (truy cập phiếu lương người khác sẽ bị chặn 403 ngay lập tức).
- `POST /hr/me/leave-requests`: Tạo đơn xin nghỉ phép cho chính mình.

### 3.3. Quản Lý Công Việc (Tasks) Theo Quyền Sở Hữu
- Tạo công việc: Mọi người dùng đã đăng nhập đều có thể tạo công việc cho bản thân hoặc dự án.
- Sửa / Xoá công việc:
  - Người tạo công việc (`creator_id === user.id`) luôn có quyền sửa và xoá công việc của mình.
  - Người dùng có quyền `PROJECTS:update` hoặc `PROJECTS:delete` có thể sửa/xoá công việc của thành viên khác.
  - Người không phải người tạo và không có quyền `PROJECTS` khi cố sửa/xoá công việc của người khác sẽ nhận lỗi 403.

---

## 4. Quy Tắc Tài Khoản Quản Trị Tối Cao (Super Admin)

- Người dùng có `username === 'admin'` được định danh là Quản trị viên cấp cao nhất.
- **Bypass toàn diện**: Mọi lời gọi API từ tài khoản `admin` được bỏ qua lớp kiểm tra quyền (`RbacGuard` trả về `ALLOW`), đảm bảo không bao giờ bị khoá ngoài hệ thống.
- **Bảo vệ tài khoản**:
  - Không tài khoản nào khác có thể xoá tài khoản `admin`.
  - Không tài khoản nào khác có thể đổi mật khẩu của tài khoản `admin` thông qua API `/users/:id/change-password`.
  - Chỉ tài khoản `admin` mới được phân quyền hoặc hạ quyền các nhóm quản trị.

---

## 5. Hướng Dẫn Vận Hành Chế Độ RBAC (ENFORCE vs SHADOW)

### 5.1. Hai Chế Độ Hoạt Động
1. **SHADOW (Mặc định cho tenant cũ & diễn tập)**:
   - Các API `@Perm` không chặn request; nếu người dùng thiếu quyền, hệ thống vẫn cho qua (`200 OK`) nhưng ghi lại nhật ký cảnh báo vào bảng `rbac_access_logs` với quyết định `DENY_NO_PERM`.
   - Giúp kiểm toán và phát hiện các luồng thiếu quyền trước khi bật chặn thật.
2. **ENFORCE (Chế độ siết chặt an toàn)**:
   - Mọi request không đủ quyền sẽ bị chặn ngay lập tức với mã lỗi HTTP **403 Forbidden** và thông báo tiếng Việt cụ thể (VD: *Bạn không có quyền "view" trong module "SALES"*).

### 5.2. Cách Bật ENFORCE Cho Từng Tenant
Người dùng có quyền `SYSTEM:update` hoặc `admin` có thể chuyển chế độ của tenant:
```http
PUT /api/auth/rbac/mode
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "mode": "ENFORCE"
}
```
Hoặc chỉnh sửa trực tiếp trong bảng `system_configs`:
```sql
INSERT INTO "tenant_schema"."system_configs" ("key", "value", "description")
VALUES ('RBAC_MODE', 'ENFORCE', 'Che do phan quyen')
ON CONFLICT ("key") DO UPDATE SET "value" = 'ENFORCE';
```

### 5.3. Công Tắc Khẩn Cấp Toàn Hệ Thống (`RBAC_FORCE_MODE`)
Khi triển khai môi trường Production, nếu phát hiện lỗi phân quyền nghiêm trọng ảnh hưởng đến người dùng vận hành, quản trị viên hệ thống có thể kích hoạt công tắc khẩn cấp mà **không cần sửa cơ sở dữ liệu**:

1. Cấu hình biến môi trường trên server:
   ```env
   RBAC_FORCE_MODE=SHADOW
   ```
2. Khởi động lại dịch vụ backend (NestJS API).
3. **Hiệu lực**: Biến này sẽ **ghi đè tức thì chế độ của tất cả các tenant** về `SHADOW`, mở lại quyền truy cập tạm thời cho toàn bộ người dùng để tiến hành điều tra.
4. Sau khi khắc phục xong, gỡ bỏ biến `RBAC_FORCE_MODE` (hoặc đặt giá trị rỗng) và restart lại backend để khôi phục cấu hình riêng của từng tenant.
