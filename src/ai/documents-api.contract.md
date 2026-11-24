# Hợp đồng API Đọc Chứng từ AI (AI Document Scan API Contract)

Tài liệu hợp đồng giữa Frontend (core) và Backend OCR & Trích xuất AI (cloud).
Backend triển khai ở repo cloud (P9e2, P9e3). Core (P9e1) khai báo entity, migration, hợp đồng và giao diện duyệt/liên kết chứng từ.

---

## 1. Xác thực & Phân quyền chung
- Tất cả endpoint yêu cầu header HTTP:
  ```http
  Authorization: Bearer <jwt_token>
  ```
- **Gói tính năng:** Tenant phải được kích hoạt gói `AI` (`@RequiresPackage(PackageKey.AI)`). Nếu chưa kích hoạt -> trả về `403 PACKAGE_NOT_ENABLED`.
- **Hạn mức OCR:** Mỗi tenant có hạn mức `ocr_pages` hàng tháng (ảnh = 1 trang, PDF = số trang thực tế). Nếu vượt quá hạn mức -> trả về **`402 INSUFFICIENT_OCR_QUOTA`**. XML không tiêu tốn hạn mức `ocr_pages`.
- **Giới hạn tốc độ (Rate Limit):** Tối đa **30 lần đọc/người/giờ**. Vượt quá -> trả về **`429 RATE_LIMITED`**.
- **Phân quyền tạo theo loại chứng từ (`kind`):**
  - `supplier_quote` (Báo giá / PO nhà cung cấp): Yêu cầu quyền `PURCHASE` / `PURCHASING` `create`.
  - `delivery_note` (Phiếu giao hàng): Yêu cầu quyền `INVENTORY` `create`.
  - `expense_invoice` (Hoá đơn chi phí): Yêu cầu quyền `FINANCE` `create`.
  - `auto`: Yêu cầu ít nhất 1 trong 3 quyền trên.
- **Quyền xem bản đọc (`GET /api/ai/documents/:id` và file):**
  - Người tạo (`created_by === req.user.id`), hoặc người có quyền `view` của module đích tương ứng, hoặc `admin`.
  - Người dùng không có quyền hoặc ID không tồn tại -> trả về **`404 Not Found`** (không trả về 403 để tránh rò rỉ sự tồn tại của chứng từ).
- **Quyền liên kết (`POST /api/ai/documents/:id/link`):**
  - Chỉ người tạo bản đọc (`created_by === req.user.id`).
  - Kiểm tra bản ghi chứng từ đích tồn tại và người gọi có quyền xem module đó.
- **Thời hạn lưu trữ (Retention):**
  - File gốc và dữ liệu trích xuất luôn được lưu **90 ngày** (`expires_at = created_at + 90 days`).
  - Cron hằng ngày xoá bản ghi và file khi `expires_at < now()`.

---

## 2. Quy định File & Giới hạn
- **Định dạng được chấp nhận:**
  - Ảnh: JPEG (`image/jpeg`), PNG (`image/png`), WebP (`image/webp`), HEIC (`image/heic`).
  - Tài liệu: PDF (`application/pdf`). Tối đa **5 trang**.
  - Hóa đơn điện tử: XML TT78 (`application/xml`, `text/xml`).
- **Kích thước tối đa:** **10 MB** (10 * 1024 * 1024 bytes).
- **Kiểm tra an toàn:**
  - Server bắt buộc xác định loại file bằng **magic bytes** (không tin extension hay mime-type từ client gửi lên).
  - XML phải chặn tuyệt đối XXE (External Entity Expansion / DTD).
  - Lưu trữ file tại đường dẫn riêng tư của tenant `private/ai-scans/<tenant>/<uuid>`, tuyệt đối không đặt trong thư mục public `/uploads`.
  - Tải file qua endpoint riêng kèm các header bảo mật:
    ```http
    Content-Disposition: inline
    X-Content-Type-Options: nosniff
    ```
- **Tái sử dụng theo hash (sha256):**
  - Cùng sha256 và cùng kind trong 90 ngày -> trả về kết quả đã trích xuất trước đó, không gọi lại AI, không trừ hạn mức `ocr_pages`.

---

## 3. Danh sách Endpoint REST

### 3.1. Tải lên và trích xuất chứng từ
- **Phương thức:** `POST`
- **Đường dẫn:** `/api/ai/documents`
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `file`: File nhị phân (Ảnh, PDF, XML).
  - `kind`: `supplier_quote` | `delivery_note` | `expense_invoice` | `auto`
- **Response 201 Created:**
  ```json
  {
    "id": "a1b2c3d4-e5f6-47a8-8901-000000000001",
    "status": "ready",
    "kind": "supplier_quote",
    "source": "image",
    "file_key": "private/ai-scans/tenant_1/a1b2c3d4-e5f6-47a8-8901-000000000001.jpg",
    "mime": "image/jpeg",
    "size_bytes": 245800,
    "page_count": 1,
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "extracted": {
      "supplier": {
        "name": "NCC Test 01",
        "tax_code": "0100000001",
        "address": "Số 1 Đường Thử Nghiệm, Phường 1, Quận 1, TP. HCM"
      },
      "document_no": "BG-2026-001",
      "document_date": "2026-11-24",
      "currency": "VND",
      "valid_until": "2026-12-24",
      "delivery_date": "2026-12-05",
      "lines": [
        {
          "description": "Vải Cotton 100% 4 chiều màu đen",
          "sku_or_code": "SKU-TEST-01",
          "unit": "Mét",
          "quantity": 100,
          "unit_price": 50000,
          "amount": 5000000,
          "tax_rate": 8
        }
      ],
      "subtotal": 5000000,
      "tax_amount": 400000,
      "total": 5400000
    },
    "field_confidence": {
      "supplier.name": "high",
      "supplier.tax_code": "high",
      "supplier.address": "medium",
      "document_no": "high",
      "document_date": "high",
      "valid_until": "low",
      "delivery_date": "medium",
      "lines[0].description": "high",
      "lines[0].sku_or_code": "high",
      "lines[0].quantity": "high",
      "lines[0].unit_price": "high",
      "lines[0].amount": "high",
      "lines[0].tax_rate": "high",
      "subtotal": "high",
      "tax_amount": "high",
      "total": "high"
    },
    "warnings": [],
    "suggestions": {
      "supplier_id": 15,
      "items": [
        {
          "line_index": 0,
          "material_id": 42,
          "product_id": null
        }
      ],
      "po_id": null,
      "duplicate_transaction_id": null
    },
    "expires_at": "2027-02-22T11:00:00.000Z"
  }
  ```

- **Mã lỗi chuẩn:**
  | HTTP Code | Mã lỗi (`code`) | Ý nghĩa & Cấu trúc | Thông báo tiếng Việt giao diện |
  |---|---|---|---|
  | `400` | `UNSUPPORTED_FILE` | Loại file không được hỗ trợ (chỉ nhận JPEG, PNG, WebP, HEIC, PDF, XML). | Định dạng file không được hỗ trợ (chỉ nhận ảnh JPEG/PNG/WebP/HEIC, PDF hoặc XML) |
  | `400` | `FILE_TOO_LARGE` | Dung lượng file vượt quá 10 MB. | Kích thước file vượt quá giới hạn 10 MB |
  | `400` | `TOO_MANY_PAGES` | Tài liệu PDF có nhiều hơn 5 trang. | File PDF vượt quá giới hạn tối đa 5 trang |
  | `402` | `INSUFFICIENT_OCR_QUOTA` | Hết hạn mức đọc trang OCR trong tháng theo gói AI. | Đã hết hạn mức đọc chứng từ (OCR) của gói AI trong tháng |
  | `403` | `PACKAGE_NOT_ENABLED` | Gói AI chưa kích hoạt trên tenant. | Gói tính năng AI chưa được kích hoạt |
  | `403` | `FORBIDDEN` | Người dùng không có quyền create cho module tương ứng. | Bạn không có quyền thực hiện hành động này |
  | `422` | `EXTRACTION_FAILED` | Không thể phân tích nội dung chứng từ (ảnh mờ, hỏng cấu trúc). | Không thể trích xuất dữ liệu từ chứng từ. Vui lòng kiểm tra lại chất lượng file |
  | `429` | `RATE_LIMITED` | Vượt quá 30 lần đọc/người/giờ. | Vượt quá giới hạn 30 lần đọc/giờ. Vui lòng thử lại sau |

---

### 3.2. Lấy thông tin bản đọc
- **Phương thức:** `GET`
- **Đường dẫn:** `/api/ai/documents/:id`
- **Params:** `id` (UUID)
- **Response 200 OK:** Cùng cấu trúc dữ liệu với 3.1.
- **Response 404 Not Found:** Nếu không tồn tại hoặc người dùng không có quyền truy cập.

---

### 3.3. Xem / Tải file gốc chứng từ
- **Phương thức:** `GET`
- **Đường dẫn:** `/api/ai/documents/:id/file`
- **Headers yêu cầu:** `Authorization: Bearer <jwt_token>`
- **Response 200 OK:** Stream file nhị phân.
  - Header bắt buộc:
    ```http
    Content-Type: image/jpeg (hoặc application/pdf, text/xml)
    Content-Disposition: inline; filename="document_scan.jpg"
    X-Content-Type-Options: nosniff
    Cache-Control: private, max-age=3600
    ```
- **Response 404 Not Found:** Nếu không tồn tại hoặc người dùng không có quyền.

---

### 3.4. Đổi loại chứng từ (Sau khi AI đoán loại)
- **Phương thức:** `PATCH`
- **Đường dẫn:** `/api/ai/documents/:id`
- **Body:**
  ```json
  {
    "kind": "delivery_note"
  }
  ```
- **Mô tả:** Người dùng đổi loại sau khi Copilot tải lên `kind=auto`. Backend cập nhật `kind` và chạy lại phần đối chiếu gợi ý (matching `suggestions`), không gọi lại AI nếu dữ liệu trích xuất đã có.
- **Response 200 OK:** Trả về đối tượng scan đã cập nhật `kind` và `suggestions`.

---

### 3.5. Liên kết bản đọc với chứng từ nghiệp vụ đã tạo
- **Phương thức:** `POST`
- **Đường dẫn:** `/api/ai/documents/:id/link`
- **Body:**
  ```json
  {
    "result_type": "purchase_order",
    "result_id": "105"
  }
  ```
  - `result_type`: `purchase_order` | `goods_receipt` | `transaction`
  - `result_id`: ID của bản ghi nghiệp vụ đã tạo thành công trong hệ thống.
- **Response 200 OK:**
  ```json
  {
    "status": "linked",
    "result_type": "purchase_order",
    "result_id": "105"
  }
  ```
- **Ghi chú Frontend:** Được gọi ngay sau khi tạo chứng từ thành công qua API nghiệp vụ thông thường. Nếu lời gọi này thất bại, frontend chỉ hiện `message.warning`, tuyệt đối không chặn hoặc huỷ chứng từ vừa tạo.

---

### 3.6. Tra cứu chứng từ gốc theo thực thể nghiệp vụ (By Reference)
- **Phương thức:** `GET`
- **Đường dẫn:** `/api/ai/documents/by-ref`
- **Query Params:**
  - `result_type`: `purchase_order` | `goods_receipt` | `transaction`
  - `result_id`: Mã hoặc ID thực thể nghiệp vụ
- **Response 200 OK:**
  ```json
  {
    "id": "a1b2c3d4-e5f6-47a8-8901-000000000001",
    "expires_at": "2027-02-22T11:00:00.000Z"
  }
  ```
- **Response 404 / 403:** Trả về 404 khi không có chứng từ liên kết còn hạn. Frontend tự động ẩn nút / link "Chứng từ gốc".

---

## 4. Schema trích xuất (`extracted`) theo từng loại (`kind`)

### 4.1. Cấu trúc trường chung (Common Fields)
| Tên trường | Kiểu dữ liệu | Bắt buộc | Diễn giải |
|---|---|---|---|
| `supplier` | `object` | Không | Thông tin nhà cung cấp / đối tác |
| `supplier.name` | `string` | Không | Tên nhà cung cấp / đơn vị bán hàng |
| `supplier.tax_code`| `string` | Không | Mã số thuế NCC (10 hoặc 13 số) |
| `supplier.address` | `string` | Không | Địa chỉ NCC |
| `document_no` | `string` | Không | Số hiệu chứng từ / hoá đơn / báo giá |
| `document_date` | `string` (YYYY-MM-DD)| Không | Ngày lập chứng từ |
| `currency` | `string` | Có | Mặc định `VND` |
| `lines` | `array` | Có | Danh sách dòng chi tiết mặt hàng/dịch vụ |
| `lines[i].description` | `string` | Có | Diễn giải / tên hàng hóa |
| `lines[i].sku_or_code` | `string` | Không | Mã hiệu SKU hoặc mã quy ước |
| `lines[i].unit` | `string` | Không | Đơn vị tính (Cái, Cuộn, Mét, ...) |
| `lines[i].quantity` | `number` | Có | Số lượng |
| `lines[i].unit_price` | `number` | Có | Đơn giá |
| `lines[i].amount` | `number` | Có | Thành tiền (`quantity * unit_price`) |
| `lines[i].tax_rate` | `number` | Không | Thuế suất % (0, 5, 8, 10, ...) |
| `subtotal` | `number` | Có | Tổng tiền hàng chưa thuế |
| `tax_amount` | `number` | Có | Tiền thuế |
| `total` | `number` | Có | Tổng thanh toán đã gồm thuế |

### 4.2. Schema riêng `supplier_quote` (Báo giá / PO nhà cung cấp)
Kế thừa cấu trúc chung và bổ sung:
| Tên trường | Kiểu dữ liệu | Bắt buộc | Diễn giải |
|---|---|---|---|
| `valid_until` | `string` (YYYY-MM-DD) | Không | Thời hạn hiệu lực báo giá |
| `delivery_date` | `string` (YYYY-MM-DD) | Không | Ngày giao hàng cam kết |

### 4.3. Schema riêng `delivery_note` (Phiếu giao hàng / Biên bản bàn giao)
Kế thừa cấu trúc chung và bổ sung:
| Tên trường | Kiểu dữ liệu | Bắt buộc | Diễn giải |
|---|---|---|---|
| `po_reference` | `string` | Không | Mã số PO tham chiếu in trên phiếu |
| `delivery_date`| `string` (YYYY-MM-DD) | Không | Ngày xuất giao / bàn giao |

### 4.4. Schema riêng `expense_invoice` (Hoá đơn chi phí)
Kế thừa cấu trúc chung và bổ sung:
| Tên trường | Kiểu dữ liệu | Bắt buộc | Diễn giải |
|---|---|---|---|
| `invoice_series` | `string` | Không | Ký hiệu hoá đơn (VD: `1C26TAA`) |
| `invoice_no` | `string` | Không | Số hoá đơn điện tử (VD: `00000123`) |
| `payment_method`| `string` | Không | Hình thức thanh toán (`CK`, `TM`, ...) |
| `category_hint` | `string` | Không | Gợi ý danh mục chi phí (chỉ dùng gợi ý, người dùng tự chọn) |

---

## 5. Quy ước `field_confidence` & `warnings`

### 5.1. Quy ước `field_confidence`
Mỗi trường trong `extracted` được gán một mức độ tin cậy:
- `high`: Rất chắc chắn (độ tin cậy > 90% hoặc từ XML TT78).
- `medium`: Tương đối chắc chắn.
- `low`: Độ tin cậy thấp, AI đọc mờ, hoặc không khớp kiểm tra tất định -> **Frontend hiển thị viền vàng + tooltip "AI đọc chưa chắc chắn, vui lòng kiểm"**.
- `missing`: Không tìm thấy trường trong chứng từ -> **Frontend hiển thị viền đỏ**.

**Quy ước đường dẫn key (fieldPath):**
- Trường cấp 1: `total`, `subtotal`, `document_no`, `document_date`.
- Trường lồng: `supplier.name`, `supplier.tax_code`.
- Trường trong mảng `lines`: dạng `lines[i].fieldName`, ví dụ `lines[0].quantity`, `lines[1].unit_price`.

### 5.2. Cấu trúc cảnh báo `warnings`
Mảng chứa các đối tượng cảnh báo có cấu trúc tất định (không dùng câu tự do):
```json
[
  {
    "code": "duplicate_transaction_id",
    "params": {
      "transaction_id": 482,
      "vat_invoice_code": "1C26TAA-00000123",
      "supplier_name": "NCC Test 01",
      "supplier_tax_code": "0100000001"
    }
  },
  {
    "code": "subtotal_mismatch",
    "params": {
      "calculated_subtotal": 5000000,
      "extracted_subtotal": 5200000,
      "diff": 200000
    }
  }
]
```

> [!IMPORTANT]
> **Quy định kiểm trùng hoá đơn chi phí (`expense_invoice`):**
> - **Kiểm trùng hoá đơn dùng `vat_invoice_code` + NCC/MST (`supplier_tax_code` hoặc `supplier_id`)**.
> - Tuyệt đối **không** dùng `reference_code` để lưu số hoá đơn hoặc kiểm trùng (vì trong hệ thống, `transactions.reference_code` là mã liên kết PO-/SO-… dùng để đồng bộ thanh toán; hoá đơn chi phí độc lập để trống `reference_code`).
> - Số hoá đơn được chuẩn hoá vào `vat_invoice_code` theo định dạng `<ký hiệu>-<số>` (ví dụ `1C26TAA-00000123`), hoặc `<số>` nếu thiếu ký hiệu.
> - Cảnh báo `duplicate_transaction_id` gửi `params` gồm `transaction_id`, `vat_invoice_code`, `supplier_name`, `supplier_tax_code`. Phía client tự dựng câu thông báo tiếng Việt từ `code` + `params`, bỏ dùng trường `message` tự do từ server để đảm bảo an toàn và tính nhất quán.

---

## 6. Route mở form và Điểm đến (`?aiScan=<id>`)

Đối chiếu chính xác cấu trúc route thực tế trong `frontend/src/App.tsx`:

| Loại chứng từ (`kind`) | Thực thể kết quả (`result_type`) | Route mở form điền sẵn | Hành vi giao diện |
|---|---|---|---|
| `supplier_quote` | `purchase_order` | `/purchasing?aiScan=:id` | Mở giao diện `ScanReviewLayout` bên cạnh form tạo Đơn mua hàng (PO). Sau khi lưu gọi link với `result_type: 'purchase_order'`. |
| `delivery_note` | `goods_receipt` | `/inventory?aiScan=:id` | Mở giao diện `ScanReviewLayout` bên cạnh form tạo Phiếu nhập kho nháp. Sau khi lưu gọi link với `result_type: 'goods_receipt'`. |
| `expense_invoice` | `transaction` | `/finance?aiScan=:id` | Mở giao diện `ScanReviewLayout` bên cạnh modal Lập Phiếu Chi (`type: 'EXPENSE'`). Sau khi lưu gọi link với `result_type: 'transaction'`. |

**Nguyên tắc hiển thị và tương tác:**
1. **Không tự lưu:** Tuyệt đối không tự động gọi API tạo PO / phiếu nhập / phiếu chi khi mở trang qua `?aiScan`. Người dùng luôn phải tự kiểm tra và bấm "Lưu".
2. **Không render HTML thô:** Mọi giá trị từ `extracted` hoặc `warnings` đều được render dạng chuỗi thuần văn bản (text node / React escaped string) để phòng tránh XSS.
3. **Màu cảnh báo:** Dùng màu trạng thái tiêu chuẩn (vàng `#faad14` cho warning/low confidence, đỏ `#ff4d4f` cho error/missing), tuyệt đối không dùng màu cam thương hiệu (`brandColors.orange`) làm màu cảnh báo lỗi.
4. **Hiển thị file gốc:** File gốc được tải qua `GET /api/ai/documents/:id/file` sử dụng JWT của người dùng -> tạo Object URL tạm thời và thu hồi (`URL.revokeObjectURL`) khi đóng màn hình xem.
