# Hợp đồng API Nháp Hành động AI (AI Action Drafts API Contract)

Tài liệu hợp đồng giữa Frontend (core) và Backend AI Service / Cloud Executor (cloud).
Backend triển khai ở repo cloud (P9c2, P9c3). Core (P9c1) khai báo entity, migration, hợp đồng và giao diện duyệt/xác nhận nháp.

---

## 1. Xác thực & Phân quyền chung
- Tất cả endpoint yêu cầu header HTTP:
  ```http
  Authorization: Bearer <jwt_token>
  ```
- **Quyền sở hữu (Ownership):** Chỉ người dùng đã tạo nháp (`created_by === req.user.id`) mới có quyền xem (`GET`), xác nhận (`confirm`), hoặc từ chối (`reject`) bản nháp đó.
- Nếu không phải chủ sở hữu hoặc ID không phải định dạng UUID hợp lệ: trả về **`404 Not Found`** (tuyệt đối không trả về 403 để tránh rò rỉ ID hay sự tồn tại của nháp).
- Khi xác nhận nháp (`confirm`), backend kiểm tra lại:
  - Gói tính năng tương ứng với `kind` còn kích hoạt trên tenant (`@RequiresPackage`).
  - Quyền `create` của người dùng đối với module tương ứng.
  - Bản nháp phải đang ở trạng thái `pending` và chưa hết hạn (`expires_at > now()`).

---

## 2. Danh sách Endpoint REST

### 2.1. Lấy chi tiết bản nháp
- **Phương thức:** `GET`
- **Đường dẫn:** `/api/ai/drafts/:id`
- **Params:** `id` (UUID)
- **Response 200 OK:**
  ```json
  {
    "id": "d1a2b3c4-0001-4000-8000-000000000001",
    "kind": "quotation",
    "status": "pending",
    "payload": {
      "customer_id": 12,
      "order_date": "2026-11-24",
      "delivery_date": "2026-12-05",
      "items": [
        {
          "product_id": 45,
          "quantity": 100,
          "unit_price": 150000,
          "_display": { "product_name": "Áo thun Polo thể thao" }
        }
      ],
      "note": "Báo giá đơn hàng mẫu",
      "_display": {
        "customer_name": "Khách hàng Demo 01"
      }
    },
    "expires_at": "2026-11-25T06:00:00.000Z",
    "result_ref": null,
    "error_code": null
  }
  ```
- **Response 404 Not Found:** Khi không tìm thấy bản nháp, ID không hợp lệ UUID, hoặc nháp thuộc user khác:
  ```json
  {
    "statusCode": 404,
    "message": "Không tìm thấy bản nháp"
  }
  ```

---

### 2.2. Xác nhận bản nháp (Confirm Draft)
- **Phương thức:** `POST`
- **Đường dẫn:** `/api/ai/drafts/:id/confirm`
- **Headers:**
  ```http
  Content-Type: application/json
  Authorization: Bearer <jwt_token>
  ```
- **Request Body:**
  ```json
  {
    "payload": {
      "customer_id": 12,
      "order_date": "2026-11-24",
      "delivery_date": "2026-12-05",
      "items": [
        {
          "product_id": 45,
          "quantity": 100,
          "unit_price": 150000
        }
      ],
      "note": "Báo giá đơn hàng mẫu"
    }
  }
  ```
  *Lưu ý:* Frontend tự động loại bỏ tất cả trường `_display` (dùng cho hiển thị trên thẻ) trước khi gửi `payload`.
- **Response 200 OK:**
  ```json
  {
    "draftId": "d1a2b3c4-0001-4000-8000-000000000001",
    "result_ref": {
      "entity": "sales_order",
      "id": 108,
      "path": "/sales?order=108"
    }
  }
  ```
- **Quy trình chống chạy 2 lần (Race Condition):**
  Backend cập nhật nguyên tử: `UPDATE ai_drafts SET status = 'executing' WHERE id = :id AND status = 'pending'`.
  Nếu không có bản ghi nào được cập nhật -> trả về lỗi `409 DRAFT_NOT_PENDING`.
  Sau khi gọi executor thành công -> chuyển sang `confirmed` kèm `result_ref`.
  Nếu executor lỗi -> chuyển sang `failed` kèm `error_code`.
- **Các mã lỗi chuẩn (Error Responses):**
  Tất cả lỗi trả về JSON chuẩn `{ code: string, message: string, errors?: Array<{ field: string, message: string }> }`:

  | HTTP Code | Mã lỗi (`code`) | Ý nghĩa & Cấu trúc | Thông báo tiếng Việt giao diện |
  |---|---|---|---|
  | `400` | `DRAFT_INVALID` | Payload không hợp lệ theo JSON Schema hoặc thực thể tham chiếu không tồn tại trong tenant.<br>Kèm danh sách `errors: [{ field, message }]`. Trường dạng phẳng hoặc dạng đường dẫn dòng mảng (`items.0.quantity`). | Dữ liệu nháp không hợp lệ, vui lòng kiểm tra lại |
  | `403` | `FORBIDDEN` | Người dùng không có quyền tạo đối tượng trong module tương ứng. | Bạn không có quyền thực hiện hành động này |
  | `403` | `PACKAGE_NOT_ENABLED` | Gói tính năng của loại nháp chưa được bật trên tenant. | Gói tính năng này chưa được kích hoạt |
  | `404` | `NOT_FOUND` | Bản nháp không tồn tại, id không phải UUID, hoặc nháp thuộc user khác. | Bản nháp không tồn tại |
  | `409` | `DRAFT_NOT_PENDING` | Bản nháp không còn ở trạng thái `pending` (đã được xác nhận, từ chối, hết hạn hoặc đang xử lý). | Bản nháp không còn ở trạng thái chờ duyệt |
  | `422` | `EMAIL_RECIPIENT_NOT_ALLOWED` | Người nhận email (`to`) không thuộc email của khách hàng hoặc liên hệ đã lưu của khách hàng. | Địa chỉ người nhận không thuộc thông tin đã lưu của khách hàng |
  | `422` | `EMAIL_NOT_CONFIGURED` | Hệ thống SMTP của tenant chưa được cấu hình. | Cấu hình gửi email (SMTP) chưa được thiết lập |
  | `429` | `RATE_LIMITED` | Vượt quá hạn mức gửi email (tối đa 20 email xác nhận/người/giờ). | Bạn đã vượt quá giới hạn gửi email trong giờ |

  *Ví dụ lỗi 400 DRAFT_INVALID:*
  ```json
  {
    "code": "DRAFT_INVALID",
    "message": "Dữ liệu nháp không hợp lệ",
    "errors": [
      { "field": "customer_id", "message": "Khách hàng không tồn tại" },
      { "field": "items.0.quantity", "message": "Số lượng phải lớn hơn 0" }
    ]
  }
  ```

---

### 2.3. Từ chối / Bỏ bản nháp (Reject Draft)
- **Phương thức:** `POST`
- **Đường dẫn:** `/api/ai/drafts/:id/reject`
- **Headers:**
  ```http
  Authorization: Bearer <jwt_token>
  ```
- **Response 200 OK:**
  ```json
  {
    "status": "rejected"
  }
  ```
- **Response 404 / 409:** Tương tự như endpoint confirm.

---

### 2.4. Bảng tổng hợp Đường dẫn Kết quả (`result_ref.path`)
Liệt kê route **chi tiết** bản ghi có thật cho mỗi kind (route có query `?id=` cũng được), không có mới dùng route danh sách:

| Loại nháp (`kind`) | Thực thể (`entity`) | Route chi tiết (`result_ref.path`) | Cơ chế hiển thị trên frontend |
|---|---|---|---|
| `quotation` | `sales_order` | `/sales?order=:id` (hoặc `/orders?order=:id`) | Mở trực tiếp modal chi tiết báo giá / đơn hàng (`CrmPage` / `SalesPage`) |
| `task` | `task` | `/tasks?task=:id` | Mở trực tiếp modal cập nhật chi tiết công việc (`TasksPage`) |
| `lead` | `customer` | `/sales?customer=:id` (hoặc `/customers`) | Mở trực tiếp drawer theo dõi / chăm sóc khách hàng tiềm năng (`CrmPage`) |
| `purchase_order` | `purchase_order` | `/purchasing` | Trang danh sách Đơn mua hàng (chưa có query param mở modal chi tiết) |
| `production_order` | `production_order` | `/planning` | Trang Kế hoạch & Điều độ sản xuất |
| `email` | `customer` | `/customers` (hoặc `/sales?customer=:customer_id`) | Trang danh sách khách hàng / hồ sơ khách hàng đã gửi email |

---

## 3. Cấu trúc Payload theo từng loại Nháp (`kind`)

Payload của mỗi loại nháp tương thích hoàn toàn với body của API tạo thông thường của module đó:

### 3.1. `quotation` (Báo giá bán hàng)
- **Gói:** `SALES` | **Quyền:** `SALES` `can_create`
- **Form nguồn:** `SalesOrderDetail.tsx` (`frontend/src/components/SalesOrderDetail.tsx`)
- **Body tạo thường:** `SalesService.createOrder({ ..., is_quotation: true })`
- **Đường dẫn mở form:** `/sales?aiDraft=:id`
- **Đường dẫn kết quả:** `result_ref.path` = `/sales?order=:id` (hoặc `/orders?order=:id`)
- **Nguyên tắc dòng hàng:** Backend `SalesService.createOrder` lọc dòng theo `i.sku` (dòng không có `sku` bị bỏ qua). Dòng hàng BẮT BUỘC phải có `sku`.
- **Trường Payload confirm (khớp chính xác SalesOrderDetail):**
  - `customer_id` *(number, bắt buộc)*: ID khách hàng hợp lệ (hoặc `-1` nếu là nội bộ).
  - `order_code` *(string, tuỳ chọn)*: Mã đơn báo giá (backend tự sinh theo mẫu `QUOTE-YYMM-XXXX` nếu để trống hoặc bắt đầu bằng `AUTO-`).
  - `order_date` *(string YYYY-MM-DD, tuỳ chọn)*: Ngày báo giá.
  - `delivery_date` *(string YYYY-MM-DD, tuỳ chọn)*: Ngày dự kiến giao.
  - `is_quotation` *(boolean, bắt buộc/ép true)*: Đánh dấu là báo giá (backend ép giá trị `true`).
  - `total_amount` *(number, tuỳ chọn)*: Tổng tiền ước tính của đơn báo giá.
  - `note` *(string, tuỳ chọn)*: Ghi chú đơn báo giá.
  - `terms_content` *(string, tuỳ chọn)*: Điều khoản thanh toán & giao dịch.
  - `discount_rate` *(number, tuỳ chọn)*: Tỷ lệ chiết khấu (%).
  - `discount_amount` *(number, tuỳ chọn)*: Số tiền chiết khấu.
  - `deposit_percent` *(number, tuỳ chọn)*: Tỷ lệ đặt cọc (%).
  - `deposit_amount` *(number, tuỳ chọn)*: Số tiền đặt cọc.
  - `shipping_fee` *(number, tuỳ chọn)*: Phí vận chuyển.
  - `shipping_address` *(string, tuỳ chọn)*: Địa chỉ giao hàng.
  - `vat_company_name` *(string, tuỳ chọn)*: Tên công ty xuất hóa đơn VAT.
  - `vat_tax_code` *(string, tuỳ chọn)*: Mã số thuế xuất hóa đơn VAT.
  - `vat_address` *(string, tuỳ chọn)*: Địa chỉ xuất hóa đơn VAT.
  - `vat_rate` *(number, tuỳ chọn)*: Thuế suất VAT (0, 8, 10).
  - `vat_email` *(string, tuỳ chọn)*: Email nhận hóa đơn điện tử.
  - `vat_invoice_link` *(string, tuỳ chọn)*: Link tra cứu hóa đơn điện tử.
  - `require_invoice` *(boolean, tuỳ chọn)*: Yêu cầu xuất hóa đơn VAT.
  - `assigned_to_id` *(number, tuỳ chọn)*: ID nhân viên phụ trách.
  - `contact_name` *(string, tuỳ chọn)*: Tên người liên hệ.
  - `contact_phone` *(string, tuỳ chọn)*: Số điện thoại người liên hệ.
  - `is_production_sample_approved` *(boolean, tuỳ chọn)*: Duyệt mẫu sản xuất.
  - `status` *(string, tuỳ chọn)*: Backend bỏ qua/ép trạng thái `QUOTATION`.
  - `items` *(array, bắt buộc, tối thiểu 1 dòng)*:
    - `sku` *(string, bắt buộc)*: Mã SKU sản phẩm (SalesService lọc theo `i.sku`, không có sẽ bị bỏ).
    - `quantity` *(number, bắt buộc, > 0)*: Số lượng.
    - `unit_price` *(number, bắt buộc, >= 0)*: Đơn giá.
    - `total_price` *(number, tuỳ chọn)*: Thành tiền dòng hàng (Backend map vào `subtotal`).
    - `vat_content` *(string, tuỳ chọn)*: Tên hàng hóa hiển thị trên hóa đơn VAT.
    - `sample_image` *(string, tuỳ chọn)*: Link ảnh mẫu sản phẩm.
    - `image_url` *(string, tuỳ chọn)*: Link ảnh mặt hàng.
    - `price_ranges` *(any, tuỳ chọn)*: Khung giá sỉ theo số lượng.
    - `customer_note` *(string, tuỳ chọn)*: Ghi chú dành cho khách hàng.
    - `internal_note` *(string, tuỳ chọn)*: Ghi chú nội bộ.
  - `_display` *(object, tuỳ chọn)*: `{ customer_name, customer_code }` (chỉ hiển thị, tự động lọc khi confirm).

---

### 3.2. `purchase_order` (Đơn mua hàng / PO)
- **Gói:** `INVENTORY` | **Quyền:** `PURCHASE` `create`
- **Form nguồn:** `DraftPurchaseOrderModal.tsx` (`frontend/src/components/purchasing/DraftPurchaseOrderModal.tsx`)
- **Body tạo thường:** `PurchasingService.createPO(data)`
- **Đường dẫn mở form:** `/purchasing?aiDraft=:id`
- **Đường dẫn kết quả:** `result_ref.path` = `/purchasing`
- **Trường Payload confirm (chỉ các key backend nhận, KHÔNG chứa `warehouse_id`, `tax_rate`, `notes`):**
  - `supplier_id` *(number, bắt buộc)*: ID nhà cung cấp.
  - `po_code` *(string, tuỳ chọn)*: Mã PO (nếu để trống backend tự sinh).
  - `note` *(string, tuỳ chọn)*: Ghi chú đơn mua hàng.
  - `expected_delivery_date` *(string YYYY-MM-DD, tuỳ chọn)*: Ngày dự kiến giao hàng.
  - `items` *(array, bắt buộc, 1–100 dòng)*:
    - `material_id` *(number, tuỳ chọn)*: ID nguyên vật liệu (nếu mua NPL).
    - `product_id` *(number, tuỳ chọn)*: ID sản phẩm (nếu mua thành phẩm/gia công).
    - `description` *(string, tuỳ chọn)*: Diễn giải chi tiết mặt hàng.
    - `quantity` *(number, bắt buộc, > 0)*: Số lượng mua.
    - `unit_price` *(number, bắt buộc, >= 0)*: Đơn giá mua.
    - `note` *(string, tuỳ chọn)*: Ghi chú dòng.
  - *(Lưu ý: Bỏ hoàn toàn `warehouse_id`, `tax_rate`, `notes` để đảm bảo khớp schema validate backend cloud).*

---

### 3.3. `production_order` (Lệnh sản xuất)
- **Gói:** `PRODUCTION` | **Quyền:** `PRODUCTION` `create`
- **Form nguồn:** `DraftProductionOrderModal.tsx` (`frontend/src/components/planning/DraftProductionOrderModal.tsx`) — Modal tạo **Lệnh sản xuất**, không tạo PFO.
- **Body tạo thường:** `ProductionService.createOrder(data)`
- **Đường dẫn mở form:** `/planning?action=create-production-order&aiDraft=:id` (không dùng route `create-pfo`)
- **Đường dẫn kết quả:** `result_ref.path` = `/planning`
- **Trường Payload confirm (chỉ các key backend nhận, KHÔNG chứa `priority`, `note`):**
  - `product_id` *(number, bắt buộc)*: ID thành phẩm cần sản xuất.
  - `quantity` *(number, bắt buộc, > 0)*: Số lượng cần sản xuất.
  - `code` *(string, tuỳ chọn/bắt buộc)*: Mã lệnh sản xuất (VD: `LSX-2026-001`).
  - `start_date` *(string ISO, tuỳ chọn)*: Ngày bắt đầu dự kiến.
  - `due_date` *(string ISO, tuỳ chọn)*: Hạn hoàn thành dự kiến.
  - `so_code` *(string, tuỳ chọn)*: Mã đơn hàng liên quan (sales order code).
  - `pfo_id` *(number, tuỳ chọn)*: ID kế hoạch PFO liên quan.
  - `assigned_supplier_id` *(number, tuỳ chọn)*: ID xưởng / đối tác gia công phụ trách.
  - *(Lưu ý: Bỏ hoàn toàn `priority`, `note` để đảm bảo khớp schema validate backend cloud).*

---

### 3.4. `task` (Công việc)
- **Gói:** `CORE` | **Quyền:** Đăng nhập (`@AuthOnly()`)
- **Form nguồn:** Form tạo công việc trong `TasksPage.tsx` (`frontend/src/pages/TasksPage.tsx`)
- **Body tạo thường:** `TasksService.create(data)`
- **Đường dẫn mở form:** `/tasks?aiDraft=:id`
- **Đường dẫn kết quả:** `result_ref.path` = `/tasks?task=:id`
- **Trường Payload confirm (khớp chính xác form TasksPage):**
  - `title` *(string, bắt buộc, tối đa 255)*: Tiêu đề công việc.
  - `description` *(string, tuỳ chọn)*: Nội dung chi tiết công việc.
  - `priority` *(string, tuỳ chọn, 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT', mặc định 'MEDIUM')*: Mức độ ưu tiên.
  - `status` *(string, tuỳ chọn, 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE', mặc định 'TODO')*: Trạng thái công việc.
  - `project_id` *(number, tuỳ chọn)*: ID dự án liên quan.
  - `milestone_id` *(number, tuỳ chọn)*: ID mốc tiến độ trong dự án.
  - `assignee_id` *(number, tuỳ chọn)*: ID nhân viên được giao việc (chú ý: dùng `assignee_id`, không phải `assigned_user_id`).
  - `due_date` *(string ISO, tuỳ chọn)*: Hạn hoàn thành.
  - `estimated_cost` *(number, tuỳ chọn)*: Chi phí dự toán (VNĐ).
  - `actual_cost` *(number, tuỳ chọn)*: Chi phí thực tế (VNĐ).
  - `cost_note` *(string, tuỳ chọn)*: Ghi chú chi phí.
  - `creator_id` *(number, do hệ thống/form gán từ user đăng nhập)*.
  - *(Lưu ý: Bỏ `reference_code`, `reference_type` vì form TasksPage không sử dụng).*

---

### 3.5. `lead` (Khách hàng tiềm năng)
- **Gói:** `SALES` | **Quyền:** `SALES` `can_create`
- **Form nguồn:** Form tạo khách hàng trong `CustomersPage.tsx` (`frontend/src/pages/CustomersPage.tsx`)
- **Body tạo thường:** `CustomersService.create({ ..., type: 'LEAD' })`
- **Đường dẫn mở form:** `/customers?aiDraft=:id`
- **Đường dẫn kết quả:** `result_ref.path` = `/sales?customer=:id` (hoặc `/customers`)
- **Trường Payload confirm (khớp chính xác form CustomersPage):**
  - `name` *(string, bắt buộc)*: Tên khách hàng / tổ chức.
  - `code` *(string, tuỳ chọn)*: Mã khách hàng (backend tự sinh `KH-YYMM-XXXX` nếu để trống).
  - `phone` *(string, tuỳ chọn)*: Số điện thoại.
  - `email` *(string, tuỳ chọn)*: Email liên hệ.
  - `facebook` *(string, tuỳ chọn)*: Link Facebook.
  - `website` *(string, tuỳ chọn)*: Link Website.
  - `address` *(string, tuỳ chọn)*: Địa chỉ trụ sở chính.
  - `province` *(string, tuỳ chọn)*: Tỉnh / Thành phố.
  - `district` *(string, tuỳ chọn)*: Quận / Huyện.
  - `parent_id` *(number, tuỳ chọn)*: ID công ty mẹ.
  - `credit_limit` *(number, tuỳ chọn, mặc định 0)*: Hạn mức nợ.
  - `type` *(string, cố định 'LEAD')*: Backend bỏ qua/ép giá trị 'LEAD'.
  - `assigned_to_id` *(number, tuỳ chọn)*: ID nhân viên phụ trách.
  - `contacts` *(array, tuỳ chọn)*: Danh sách liên hệ:
    - `full_name` *(string, bắt buộc nếu có dòng)*: Họ tên liên hệ.
    - `job_title` *(string, tuỳ chọn)*: Chức danh.
    - `phone` *(string, tuỳ chọn)*: Số điện thoại / Email liên hệ.
  - `legal_name` *(string, tuỳ chọn)*: Tên pháp nhân trên hóa đơn.
  - `legal_address` *(string, tuỳ chọn)*: Địa chỉ pháp lý.
  - `tax_code` *(string, tuỳ chọn)*: Mã số thuế (chú ý: dùng `tax_code`, không phải `tax_id`).
  - `legal_representative` *(string, tuỳ chọn)*: Người đại diện pháp luật.
  - `einvoice_email` *(string, tuỳ chọn)*: Email nhận hóa đơn điện tử.
  - `delivery_addresses` *(array, tuỳ chọn)*: Danh sách chi nhánh / địa chỉ giao hàng:
    - `name` *(string, bắt buộc nếu có dòng)*: Tên chi nhánh / kho.
    - `address` *(string, bắt buộc nếu có dòng)*: Địa chỉ giao hàng.

---

### 3.6. `email` (Gửi email khách hàng)
- **Gói:** `SALES` | **Quyền:** `SALES` `can_create`
- **Form nguồn:** `CustomerEmailModal.tsx` (`frontend/src/components/crm/CustomerEmailModal.tsx`)
- **Body tạo thường:** `EmailService` qua SMTP của tenant
- **Đường dẫn mở form:** `/customers?aiDraft=:id`
- **Đường dẫn kết quả:** `result_ref.path` = `/customers` (hoặc `/sales?customer=:customer_id`)
- **Trường Payload confirm:**
  - `customer_id` *(number, bắt buộc)*: ID khách hàng trong tenant.
  - `to` *(string, bắt buộc)*: Email người nhận. BẮT BUỘC phải khớp với email khách hàng hoặc một trong các liên hệ thuộc khách hàng đó.
  - `subject` *(string, bắt buộc, tối đa 200 ký tự)*: Tiêu đề email.
  - `body` *(string, bắt buộc, tối đa 10.000 ký tự)*: Nội dung text thuần của email (hệ thống tự động escape khi tạo bản gửi HTML).
  - `_display` *(object, tuỳ chọn)*: `{ customer_name }` (chỉ hiển thị, bị lọc khi confirm).

---

## 4. Tích hợp SSE Copilot & Tin nhắn Hội thoại
1. Khi AI gọi công cụ soạn nháp (vd `sales.draftQuotation`):
   - AI tạo bản ghi `ai_drafts` trạng thái `pending`.
   - Trong SSE phản hồi `answer`:
     ```json
     {
       "message_id": "...",
       "content": "Tôi đã soạn nháp báo giá cho anh/chị. Vui lòng mở để duyệt.",
       "drafts": [
         {
           "id": "d1a2b3c4-0001-4000-8000-000000000001",
           "kind": "quotation",
           "title": "Báo giá Áo thun Polo",
           "summary": "100 áo thun Polo cho Khách hàng Demo 01, tổng ước tính 15.000.000 ₫"
         }
       ]
     }
     ```
2. Lưu trữ tin nhắn `ai_conversation_messages`:
   - Cột `drafts jsonb` lưu danh sách `[{ id, kind, title, summary }]`.
   - Khi gọi `GET /api/ai/v2/conversations/:id`, các tin nhắn trả về kèm trường `drafts`.
