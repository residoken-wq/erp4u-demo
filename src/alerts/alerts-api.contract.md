# Hợp đồng API Trung tâm Cảnh báo (Alerts API Contract)

Tài liệu hợp đồng giữa Core Frontend (`erp4u-demo`) và Backend AI / Cloud Alert Engine (`cloud`).
Toàn bộ tính năng thuộc gói `AI` (`@RequiresPackage('AI')`), kết hợp với gói tương ứng của từng module (`INVENTORY`, `SALES`, `FINANCE`).

---

## 1. Xác thực & Phân quyền chung

- Tất cả endpoint yêu cầu header HTTP:
  ```http
  Authorization: Bearer <jwt_token>
  ```
- **Quyền theo module (D2):**
  - Cảnh báo được lọc theo quyền của người dùng ngay lúc truy vấn:
    - `stock.low_cover`: cần quyền xem module `INVENTORY` (`can_view`).
    - `order.at_risk`: cần quyền xem module `SALES` (hoặc `PRODUCTION` nếu liên quan lệnh SX).
    - `receivable.overdue`: cần quyền xem module `FINANCE`.
    - `cash.anomaly`: cần quyền xem module `FINANCE`.
  - Admin (hoặc user có `username: admin`) xem được tất cả cảnh báo.
  - Người dùng truy cập cảnh báo mà không có quyền hoặc id không phải UUID hợp lệ: trả về **`404 Not Found`** (không trả về 403 đối với tài nguyên cá nhân để chống rò rỉ id).
- **Quyền Cài đặt Admin:**
  - Endpoint `/api/alerts/settings`, `/api/alerts/run`, `/api/alerts/runs` yêu cầu quyền `SYSTEM` hoặc user `admin`. Nếu không đủ quyền trả về **`403 Forbidden`**.

---

## 2. Danh sách Endpoint REST

### 2.1. Danh sách cảnh báo (List Alerts)
- **Phương thức:** `GET`
- **Đường dẫn:** `/api/alerts`
- **Query Params:**
  - `type` (optional): `stock.low_cover` | `order.at_risk` | `receivable.overdue` | `cash.anomaly`
  - `status` (optional): `open` | `acknowledged` | `snoozed` | `resolved` (mặc định lấy `open,snoozed,acknowledged`)
  - `severity` (optional): `low` | `medium` | `high`
  - `page` (optional, default 1): số trang
  - `limit` (optional, default 20, max 100): số phần tử mỗi trang
- **Response 200 OK:**
  ```json
  {
    "data": [
      {
        "id": "7b0a8806-03c7-43cf-bc01-a1288df79b10",
        "type": "stock.low_cover",
        "severity": "high",
        "entity_type": "product",
        "entity_id": "45",
        "fingerprint": "stock.low_cover:product:45",
        "title": "Áo Polo Nam Trắng (SP-045) còn 5 ngày tồn kho",
        "detail": {
          "item_kind": "product",
          "item_id": 45,
          "sku": "SP-045",
          "available": 10,
          "avg_daily_out": 2,
          "days_of_cover": 5,
          "threshold_days": 14
        },
        "status": "open",
        "snoozed_until": null,
        "acknowledged_by": null,
        "first_seen_at": "2026-11-24T00:00:00.000Z",
        "last_seen_at": "2026-11-24T07:00:00.000Z",
        "resolved_at": null,
        "created_at": "2026-11-24T00:00:00.000Z",
        "updated_at": "2026-11-24T07:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
  ```

---

### 2.2. Tóm tắt số lượng cảnh báo (Alerts Summary)
- Dùng cho Badge Menu, Header chuông thông báo và Widget Dashboard.
- **Phương thức:** `GET`
- **Đường dẫn:** `/api/alerts/summary`
- **Response 200 OK:**
  ```json
  {
    "total_open": 7,
    "by_type": {
      "stock.low_cover": 3,
      "order.at_risk": 2,
      "receivable.overdue": 1,
      "cash.anomaly": 1
    },
    "by_severity": {
      "high": 2,
      "medium": 4,
      "low": 1
    }
  }
  ```
- **Response 403 / 404:** Khi tenant chưa bật gói AI hoặc người dùng không có quyền: frontend bắt lỗi an toàn và ẩn widget / không hiển thị badge.

---

### 2.3. Đã xem cảnh báo (Acknowledge Alert)
- **Phương thức:** `POST`
- **Đường dẫn:** `/api/alerts/:id/acknowledge`
- **Params:** `id` (UUID)
- **Response 200 OK:**
  ```json
  {
    "id": "7b0a8806-03c7-43cf-bc01-a1288df79b10",
    "status": "acknowledged",
    "acknowledged_by": 1,
    "updated_at": "2026-11-24T10:00:00.000Z"
  }
  ```
- **Response 404 Not Found:** Khi id không tồn tại hoặc người dùng không có quyền module.

---

### 2.4. Tạm ẩn cảnh báo (Snooze Alert)
- **Phương thức:** `POST`
- **Đường dẫn:** `/api/alerts/:id/snooze`
- **Params:** `id` (UUID)
- **Request Body:**
  ```json
  {
    "days": 3
  }
  ```
  *(Giá trị `days` hợp lệ: `1`, `3`, hoặc `7`)*
- **Response 200 OK:**
  ```json
  {
    "id": "7b0a8806-03c7-43cf-bc01-a1288df79b10",
    "status": "snoozed",
    "snoozed_until": "2026-11-27T07:00:00.000Z",
    "updated_at": "2026-11-24T10:00:00.000Z"
  }
  ```
- **Response 400 Bad Request:** Khi `days` không nằm trong `[1, 3, 7]`:
  ```json
  {
    "statusCode": 400,
    "error": "VALIDATION",
    "message": "Số ngày tạm ẩn chỉ có thể là 1, 3 hoặc 7 ngày"
  }
  ```
- **Response 404 Not Found:** Khi id không tồn tại hoặc người dùng không có quyền module.

---

### 2.5. Cài đặt thông báo cá nhân (User Preferences)
- **Phương thức:** `GET`
- **Đường dẫn:** `/api/alerts/prefs`
- **Response 200 OK:**
  ```json
  {
    "prefs": [
      { "type": "stock.low_cover", "in_app": true, "email_digest": false },
      { "type": "order.at_risk", "in_app": true, "email_digest": false },
      { "type": "receivable.overdue", "in_app": true, "email_digest": false },
      { "type": "cash.anomaly", "in_app": true, "email_digest": false }
    ]
  }
  ```

- **Phương thức:** `PUT`
- **Đường dẫn:** `/api/alerts/prefs`
- **Request Body:**
  ```json
  {
    "prefs": [
      { "type": "stock.low_cover", "in_app": true, "email_digest": true },
      { "type": "order.at_risk", "in_app": true, "email_digest": false },
      { "type": "receivable.overdue", "in_app": false, "email_digest": false },
      { "type": "cash.anomaly", "in_app": true, "email_digest": true }
    ]
  }
  ```
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "updated": 4
  }
  ```

---

### 2.6. Cài đặt ngưỡng admin (Admin Settings)
- **Yêu cầu:** Quyền `SYSTEM` hoặc user `admin`.
- **Phương thức:** `GET`
- **Đường dẫn:** `/api/alerts/settings`
- **Response 200 OK:**
  ```json
  {
    "settings": [
      {
        "type": "stock.low_cover",
        "enabled": true,
        "params": {
          "threshold_days": 14,
          "high_threshold_days": 7,
          "history_days": 30
        },
        "updated_at": "2026-11-24T00:00:00.000Z"
      },
      {
        "type": "order.at_risk",
        "enabled": true,
        "params": {
          "warning_days": 3
        },
        "updated_at": "2026-11-24T00:00:00.000Z"
      },
      {
        "type": "receivable.overdue",
        "enabled": true,
        "params": {
          "min_overdue_days": 30,
          "min_amount": 100000
        },
        "updated_at": "2026-11-24T00:00:00.000Z"
      },
      {
        "type": "cash.anomaly",
        "enabled": true,
        "params": {
          "category_surge_percent": 50,
          "category_min_diff": 5000000,
          "outlier_multiplier": 3.0,
          "outlier_min_tx_count": 10
        },
        "updated_at": "2026-11-24T00:00:00.000Z"
      }
    ]
  }
  ```

- **Phương thức:** `PUT`
- **Đường dẫn:** `/api/alerts/settings`
- **Request Body:**
  ```json
  {
    "type": "stock.low_cover",
    "enabled": true,
    "params": {
      "threshold_days": 14,
      "high_threshold_days": 7,
      "history_days": 30
    }
  }
  ```
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "setting": {
      "type": "stock.low_cover",
      "enabled": true,
      "params": {
        "threshold_days": 14,
        "high_threshold_days": 7,
        "history_days": 30
      },
      "updated_at": "2026-11-24T10:15:00.000Z"
    }
  }
  ```
- **Response 400 Bad Request:** Khi giá trị `params` vi phạm khoảng min/max:
  ```json
  {
    "statusCode": 400,
    "error": "VALIDATION",
    "message": "threshold_days phải nằm trong khoảng từ 1 đến 90"
  }
  ```
- **Response 403 Forbidden:** Khi người dùng không có quyền `SYSTEM` hoặc không phải `admin`:
  ```json
  {
    "statusCode": 403,
    "error": "FORBIDDEN",
    "message": "Bạn không có quyền quản lý cấu hình hệ thống"
  }
  ```

---

### 2.7. Quét lại ngay (Trigger Manual Scan)
- **Yêu cầu:** Quyền `SYSTEM` hoặc user `admin`.
- **Phương thức:** `POST`
- **Đường dẫn:** `/api/alerts/run`
- **Response 200 OK:**
  ```json
  {
    "success": true,
    "run_id": "9c12b7a0-0010-4000-8000-000000000001",
    "status": "running",
    "message": "Đã kích hoạt quét cảnh báo"
  }
  ```
- **Response 429 Rate Limited:** Khi kích hoạt lại trong vòng 15 phút:
  ```json
  {
    "statusCode": 429,
    "error": "RATE_LIMITED",
    "message": "Chỉ được phép quét lại tối đa 1 lần mỗi 15 phút. Vui lòng thử lại sau.",
    "retry_after_seconds": 650
  }
  ```

---

### 2.8. Lịch sử các lần quét (Scan Runs History)
- **Phương thức:** `GET`
- **Đường dẫn:** `/api/alerts/runs`
- **Query Params:** `limit` (default 10, max 50)
- **Response 200 OK:**
  ```json
  {
    "runs": [
      {
        "id": "9c12b7a0-0010-4000-8000-000000000001",
        "started_at": "2026-11-24T07:00:00.000Z",
        "finished_at": "2026-11-24T07:00:15.000Z",
        "status": "success",
        "counts": {
          "created": 2,
          "updated": 5,
          "resolved": 1
        },
        "error_code": null
      }
    ]
  }
  ```

---

## 3. Cấu trúc trường `detail` từng Type

Mỗi loại cảnh báo lưu trữ số liệu định lượng và mã định danh trong trường `detail` (dạng JSONB). Tuyệt đối **không** chứa dữ liệu nhạy cảm của khách hàng (như họ tên thật, email, số điện thoại).

### 3.1. `stock.low_cover` (Tồn kho thấp)
| Trường | Kiểu | Mô tả | Ví dụ |
|---|---|---|---|
| `item_kind` | `'product' \| 'material'` | Phân loại mặt hàng (sản phẩm hoặc nguyên phụ liệu) | `"product"` |
| `item_id` | `number` | ID của sản phẩm hoặc nguyên liệu | `45` |
| `sku` | `string` | Mã SKU mặt hàng | `"SP-045"` |
| `available` | `number` | Tồn khả dụng (`in_stock - reserved`) | `10` |
| `avg_daily_out` | `number` | Tốc độ xuất bình quân 30 ngày (đơn vị/ngày) | `2.0` |
| `days_of_cover` | `number` | Số ngày đủ hàng (`available / avg_daily_out`) | `5` |
| `threshold_days` | `number` | Ngưỡng cấu hình cảnh báo | `14` |

### 3.2. `order.at_risk` (Đơn hàng trễ hạn)
| Trường | Kiểu | Mô tả | Ví dụ |
|---|---|---|---|
| `order_id` | `number` | ID đơn bán hàng (`sales_order`) | `108` |
| `order_code` | `string` | Mã chứng từ đơn bán | `"SO-202611-001"` |
| `delivery_date` | `string` | Ngày hẹn giao hàng (ISO YYYY-MM-DD) | `"2026-11-25"` |
| `days_until_delivery` | `number` | Số ngày đến hạn giao (âm nếu đã quá hạn) | `-1` |
| `risk_reason` | `'overdue' \| 'due_soon' \| 'mo_overdue' \| 'mo_due_after_delivery'` | Nguyên nhân rủi ro trễ hạn | `"overdue"` |
| `production_order_id` | `number \| null` | ID lệnh sản xuất liên quan (nếu có) | `52` |
| `production_order_code` | `string \| null` | Mã lệnh sản xuất | `"MO-052"` |
| `production_due_date` | `string \| null` | Ngày hoàn tất dự kiến của lệnh SX | `"2026-11-26"` |

### 3.3. `receivable.overdue` (Công nợ quá hạn)
| Trường | Kiểu | Mô tả | Ví dụ |
|---|---|---|---|
| `order_id` | `number` | ID đơn bán hàng | `92` |
| `order_code` | `string` | Mã đơn hàng | `"SO-202610-015"` |
| `customer_id` | `number` | ID khách hàng | `14` |
| `customer_code` | `string` | Mã khách hàng | `"KH-014"` |
| `total_amount` | `number` | Tổng giá trị đơn hàng (VNĐ) | `15000000` |
| `paid_amount` | `number` | Số tiền đã thanh toán (VNĐ) | `5000000` |
| `remaining_amount` | `number` | Số tiền còn nợ (`total_amount - paid_amount`) | `10000000` |
| `overdue_days` | `number` | Số ngày đã quá hạn | `45` |
| `aging_bracket` | `'30_59' \| '60_89' \| '90_plus'` | Phân nhóm tuổi nợ | `"30_59"` |

### 3.4. `cash.anomaly` (Biến động chi phí)
| Trường | Kiểu | Mô tả | Ví dụ |
|---|---|---|---|
| `sub_type` | `'category_surge' \| 'single_outlier'` | Phân loại biến động (tăng vọt theo danh mục hoặc giao dịch đột biến) | `"category_surge"` |
| `category_id` | `number` | ID danh mục thu chi | `8` |
| `category_name` | `string` | Tên danh mục thu chi | `"Chi phí vận chuyển"` |
| `transaction_id` | `number \| null` | ID giao dịch cụ thể (khi `sub_type === 'single_outlier'`) | `240` |
| `current_amount` | `number` | Số tiền chi kỳ này | `18500000` |
| `baseline_amount` | `number` | Số tiền chi chuẩn (trung bình hoặc trung vị) | `9000000` |
| `diff_amount` | `number` | Mức chênh lệch tăng | `9500000` |
| `ratio` | `number` | Tỉ lệ tăng thực tế (`current / baseline`) | `2.05` |
| `threshold_ratio` | `number` | Ngưỡng tỉ lệ cấu hình | `1.5` |

---

## 4. Bảng `params` Settings từng Type (Admin Config)

| Type | Tham số | Kiểu | Min | Max | Mặc định | Ý nghĩa |
|---|---|---|---|---|---|---|
| `stock.low_cover` | `threshold_days` | `number` | 1 | 90 | 14 | Số ngày đủ hàng bắt đầu cảnh báo trung bình |
| | `high_threshold_days` | `number` | 1 | 30 | 7 | Số ngày đủ hàng cảnh báo mức độ cao |
| | `history_days` | `number` | 7 | 90 | 30 | Số ngày tính tốc độ xuất bình quân |
| `order.at_risk` | `warning_days` | `number` | 1 | 14 | 3 | Số ngày trước hạn giao hàng để cảnh báo |
| `receivable.overdue` | `min_overdue_days` | `number` | 7 | 180 | 30 | Số ngày nợ tối thiểu để phát hiện quá hạn |
| | `min_amount` | `number` | 0 | 100,000,000 | 100,000 | Số tiền nợ tối thiểu để tạo cảnh báo (VNĐ) |
| `cash.anomaly` | `category_surge_percent` | `number` | 10 | 200 | 50 | % chi tăng so với 3 tháng trước để cảnh báo |
| | `category_min_diff` | `number` | 500,000 | 50,000,000 | 5,000,000 | Mức chênh lệch tiền mặt tối thiểu (VNĐ) |
| | `outlier_multiplier` | `number` | 1.5 | 10.0 | 3.0 | Bội số so với trung vị 6 tháng |
| | `outlier_min_tx_count` | `number` | 3 | 50 | 10 | Số giao dịch tối thiểu để áp dụng trung vị |

---

## 5. Ánh xạ Mở Chứng từ (`entity_type` → Route nội bộ)

Đối chiếu với hệ thống định tuyến thực tế trong `frontend/src/App.tsx`:

| `entity_type` | `entity_id` | Route nội bộ mở chứng từ | Ghi chú |
|---|---|---|---|
| `product` | ID sản phẩm | `/products` | Trang quản lý sản phẩm |
| `material` | ID nguyên phụ liệu | `/materials` | Trang quản lý nguyên phụ liệu |
| `sales_order` | ID đơn bán hàng | `/orders` | Trang quản lý đơn hàng SO |
| `production_order` | ID lệnh sản xuất | `/planning` | Trang lập kế hoạch & Lệnh SX |
| `transaction` | ID giao dịch thu chi | `/finance` | Sổ quỹ & Giao dịch tài chính |
| `transaction_category` | ID danh mục | `/finance` | Trang tài chính thu/chi |

**Quy tắc an toàn đường dẫn nội bộ:**
- Phải bắt đầu bằng một dấu `/` đơn (ví dụ `/products`).
- Tuyệt đối không bắt đầu bằng `//` (ngăn Open Redirect).
- Tuyệt đối không chứa `javascript:`, `data:`, `vbscript:`, hoặc các giao thức ngoài (`http://`, `https://`).
