# Hợp đồng API Copilot v2 (Copilot API Contract)

Tài liệu hợp đồng giữa Frontend (core) và Backend AI Service (cloud).
Backend triển khai ở repo cloud (P9b3). Frontend ở core (P9b2) gọi theo đúng đặc tả dưới đây.

---

## 1. Xác thực & Phân quyền chung
- Tất cả endpoint yêu cầu header HTTP:
  ```http
  Authorization: Bearer <jwt_token>
  ```
- Backend kiểm tra gói kích hoạt `@RequiresPackage(PackageKey.AI)`.
- Người dùng chỉ truy cập được các cuộc hội thoại và tin nhắn thuộc về chính `user_id` của họ (được trích từ JWT token). Truy cập cuộc hội thoại của user khác trả về lỗi `404 Not Found` (không để lộ sự tồn tại của ID).

---

## 2. Danh sách Endpoint REST

### 2.1. Lấy danh sách hội thoại
- **Phương thức:** `GET`
- **Đường dẫn:** `/api/ai/v2/conversations`
- **Response:** `200 OK`
  ```json
  [
    {
      "id": "c1f7a83d-3b5a-4e31-893d-82d2c1274f81",
      "title": "Hỏi doanh thu tháng 11",
      "updated_at": "2026-11-23T09:30:00.000Z"
    }
  ]
  ```
  Sắp xếp giảm dần theo `updated_at DESC`.

### 2.2. Lấy chi tiết một hội thoại kèm lịch sử tin nhắn
- **Phương thức:** `GET`
- **Đường dẫn:** `/api/ai/v2/conversations/:id`
- **Response:** `200 OK`
  ```json
  {
    "id": "c1f7a83d-3b5a-4e31-893d-82d2c1274f81",
    "title": "Hỏi doanh thu tháng 11",
    "messages": [
      {
        "id": "m1a2b3c4-0001-4000-8000-000000000001",
        "role": "user",
        "content": "Doanh thu tháng này đạt bao nhiêu?",
        "tool_steps": null,
        "sources": null,
        "error_code": null,
        "drafts": null,
        "created_at": "2026-11-23T09:30:00.000Z"
      },
      {
        "id": "m1a2b3c4-0001-4000-8000-000000000002",
        "role": "assistant",
        "content": "Doanh thu tháng 11/2026 hiện tại là **1.250.000.000 ₫**.",
        "tool_steps": [
          { "tool": "sales.revenueSummary", "label": "Đang tính tổng hợp doanh thu…" }
        ],
        "sources": [
          {
            "type": "sales_order",
            "id": "SO-2026-001",
            "label": "Đơn hàng SO-2026-001",
            "path": "/orders"
          }
        ],
        "drafts": [
          {
            "id": "d1a2b3c4-0001-4000-8000-000000000001",
            "kind": "quotation",
            "title": "Báo giá Đơn hàng SO-2026-001",
            "summary": "Báo giá cho Khách hàng Demo 01, tổng tiền ước tính 1.250.000.000 ₫"
          }
        ],
        "error_code": null,
        "created_at": "2026-11-23T09:30:05.000Z"
      }
    ]
  }
  ```
  Sắp xếp tin nhắn tăng dần theo `created_at ASC`.

### 2.3. Cập nhật tiêu đề hội thoại
- **Phương thức:** `PATCH`
- **Đường dẫn:** `/api/ai/v2/conversations/:id`
- **Request Body:**
  ```json
  {
    "title": "Phân tích doanh thu & công nợ Q4"
  }
  ```
- **Response:** `200 OK`
  ```json
  {
    "id": "c1f7a83d-3b5a-4e31-893d-82d2c1274f81",
    "title": "Phân tích doanh thu & công nợ Q4",
    "updated_at": "2026-11-23T09:35:00.000Z"
  }
  ```

### 2.4. Xoá cuộc hội thoại
- **Phương thức:** `DELETE`
- **Đường dẫn:** `/api/ai/v2/conversations/:id`
- **Response:** `200 OK` hoặc `204 No Content`
  ```json
  {
    "success": true
  }
  ```
  Cascade xoá toàn bộ tin nhắn liên quan.

---

## 3. Gửi tin nhắn qua Server-Sent Events (SSE)

- **Phương thức:** `POST`
- **Đường dẫn:** `/api/ai/v2/conversations/messages`
- **Headers:**
  ```http
  Content-Type: application/json
  Authorization: Bearer <jwt_token>
  Accept: text/event-stream
  ```
- **Request Body:**
  ```json
  {
    "conversation_id": "c1f7a83d-3b5a-4e31-893d-82d2c1274f81",
    "message": "Kiểm tra tồn kho các mặt hàng dưới mức tối thiểu"
  }
  ```
  *Lưu ý:*
  - `conversation_id` là tuỳ chọn (`string | undefined`). Nếu không gửi (hoặc null), backend tự tạo cuộc hội thoại mới với tiêu đề ngắn trích từ câu hỏi.
  - `message`: chuỗi ký tự, tối đa 4000 ký tự. Không được để trống.
  - Client gửi bằng standard `fetch()` kèm đọc luồng stream `response.body.getReader()`, **không** dùng `EventSource` (vì cần hỗ trợ method POST và header Authorization).

### Luồng sự kiện SSE
Định dạng SSE chuẩn `event: <tên_sự_kiện>\ndata: <json_string>\n\n`.

1. **`conversation`** (Luôn gửi đầu tiên khi bắt đầu stream):
   ```sse
   event: conversation
   data: {"id":"c1f7a83d-3b5a-4e31-893d-82d2c1274f81","title":"Kiểm tra tồn kho các mặt hàng"}
   ```

2. **`step`** (Gửi khi AI chuẩn bị chạy một công cụ tra cứu):
   ```sse
   event: step
   data: {"tool":"inventory.lowStock","label":"Đang tra cứu tồn kho dưới mức tối thiểu…"}
   ```
   *Có thể gửi 0, 1 hoặc nhiều sự kiện `step` tuỳ theo số bước tool.*

3. **`answer`** (Gửi nội dung câu trả lời hoàn chỉnh kèm nguồn tham chiếu và nháp hành động nếu có):
   ```sse
   event: answer
   data: {"message_id":"m1a2b3c4-0001-4000-8000-000000000003","content":"Hiện có **3 mặt hàng** đang dưới mức tồn an toàn...","sources":[{"type":"material","id":"MAT-01","label":"Vải Cotton 100%","path":"/materials"}],"drafts":[{"id":"d1a2b3c4-0001-4000-8000-000000000001","kind":"purchase_order","title":"Đơn mua NPL Vải Cotton 100%","summary":"Mua 500m Vải Cotton từ NCC Dệt may Demo 01"}]}
   ```

4. **`error`** (Gửi khi xảy ra lỗi trong quá trình xử lý):
   ```sse
   event: error
   data: {"code":"AI_QUOTA_EXCEEDED","message":"Đã hết hạn mức AI của tháng"}
   ```
   **Bảng mã lỗi chuẩn (`code`):**
   | Mã lỗi (`code`) | Ý nghĩa & Thông báo tiếng Việt giao diện |
   |---|---|
   | `AI_QUOTA_EXCEEDED` | Đã hết hạn mức AI của tháng |
   | `AI_NOT_CONFIGURED` | AI chưa được cấu hình, liên hệ quản trị viên |
   | `AI_KEY_MISSING` | Chưa cấu hình API key AI, liên hệ quản trị viên |
   | `PACKAGE_NOT_ENABLED` | Gói tính năng AI chưa được kích hoạt trên hệ thống |
   | `FORBIDDEN` | Bạn không có quyền thực hiện yêu cầu này |
   | `INTERNAL` | Lỗi xử lý từ hệ thống AI, vui lòng thử lại sau |

5. **`done`** (Gửi khi kết thúc hoàn toàn phiên stream):
   ```sse
   event: done
   data: {}
   ```

---

## 4. Chính sách lưu trữ & Giới hạn
- Lịch sử hội thoại được lưu giữ tối đa 90 ngày (`AI_CHAT_RETENTION_DAYS = 90`).
- Gợi ý UI hiển thị cảnh báo: *"Lịch sử được lưu 90 ngày."* và *"AI có thể sai — kiểm tra lại số liệu trước khi quyết định."*
- Giới hạn kích thước tin nhắn người dùng nhập: tối đa 4.000 ký tự.
