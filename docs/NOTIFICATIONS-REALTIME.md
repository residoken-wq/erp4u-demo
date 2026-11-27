# Tài liệu Thiết kế & Vận hành Thông báo Tức thời (Server-Sent Events)

## 1. Tổng quan & Kiến trúc

Hệ thống thông báo tức thời (Real-time Notifications) của ERP4U sử dụng chuẩn **Server-Sent Events (SSE)** qua endpoint:
```http
GET /api/notifications/stream
```

### Đặc điểm kiến trúc:
- **Chuẩn giao tiếp:** HTTP SSE (`text/event-stream`), một chiều từ máy chủ đến trình duyệt, tối ưu cho thông báo dạng sự kiện đơn lẻ mà không cần mở kết nối hai chiều phức tạp như WebSocket.
- **Xác thực bảo mật:** Sử dụng header chuẩn `Authorization: Bearer <token>`. **Tuyệt đối không nhận token qua URL query string** (như `?token=...`) để tránh rò rỉ token truy cập vào nhật ký proxy, web server và lịch sử trình duyệt.
- **Cách ly đa tenant (Tenant Isolation):**
  - Trong kiến trúc đa tenant của ERP4U, mỗi tenant có một schema riêng biệt trong cơ sở dữ liệu PostgreSQL. Do đó, `user_id` chỉ duy nhất trong phạm vi từng tenant (user id 5 của tenant A hoàn toàn khác user id 5 của tenant B).
  - Khi tạo thông báo (`NotificationsService.create()`), đối tượng `NotificationEvent` được gắn khóa định danh tenant (`tenantId`) lấy từ `TenantContext.current()`.
  - Endpoint stream lọc sự kiện theo **đồng thời cả tenantId và user_id**. Người dùng id 5 của tenant A tuyệt đối không bao giờ nhận sự kiện thông báo của người dùng id 5 tenant B.
  - Các bản cài đặt single-tenant / demo sử dụng tenant mặc định (`default`), vẫn tuân thủ cơ chế cách ly đồng nhất.
- **Định dạng dữ liệu phát (Payload):**
  - Chỉ phát sự kiện thuộc về chính người dùng đang kết nối.
  - Payload là bản ghi JSON chứa thông tin cơ bản:
    ```json
    {
      "id": 123,
      "title": "📋 Bạn được giao việc mới",
      "message": "Công việc \"Lắp ráp module A\" đã được giao cho bạn.",
      "type": "INFO",
      "link": "/tasks?task=123",
      "is_read": false,
      "created_at": "2026-11-27T10:00:00.000Z"
    }
    ```
- **Nhịp tim duy trì kết nối (Heartbeat):**
  - Định kỳ 25 giây, máy chủ gửi một dòng comment SSE `: ping\n\n`.
  - Comment bắt đầu bằng dấu `:` theo chuẩn SSE không kích hoạt sự kiện dữ liệu ở client, nhưng duy trì dòng byte liên tục để các proxy và tường lửa không ngắt kết nối do quá thời gian chờ (idle timeout).
- **Quản lý vòng đời kết nối:**
  - Khi trình duyệt đóng tab hoặc ngắt kết nối (`close`), máy chủ tự động huỷ bỏ RxJS subscription và xoá timer tương ứng, giải phóng bộ nhớ.
  - Khi JWT hết hạn (dựa trên claim `exp` trong token), máy chủ chủ động đóng stream để yêu cầu client xác thực lại bằng token mới.
  - **Giới hạn số lượng kết nối:** Mỗi người dùng trong một tenant chỉ được duy trì tối đa **5 kết nối đồng thời** (ví dụ: mở tối đa 5 tab). Khi kết nối thứ 6 được tạo ra, kết nối cũ nhất sẽ tự động được đóng lại.
  - Số lượng kết nối đang mở được ghi ở mức log `DEBUG`, không ghi nội dung thông báo vào nhật ký hệ thống.

---

## 2. Giới hạn: In-Memory Subject & Mở rộng Multi-Instance

### Giới hạn hiện tại:
- Sự kiện SSE hiện được phát thông qua một đối tượng bộ nhớ `Subject<NotificationEvent>` của thư viện RxJS nằm trong dịch vụ `NotificationsService`.
- Cơ chế này **hoàn toàn chính xác và tối ưu cho môi trường chạy 1 instance API** (mô hình SaaS hiện tại của ERP4U).

### Thách thức khi mở rộng nhiều instance (Multi-instance / Horizontal Pod Autoscaling):
- Khi hệ thống mở rộng thành nhiều tiến trình API nằm sau bộ cân bằng tải (Load Balancer):
  - Người dùng User A có thể duy trì kết nối SSE với **Instance 1**.
  - Một tác vụ nền hoặc một người dùng khác tạo thông báo cho User A trên **Instance 2**.
  - Do `Subject` chỉ nằm trên bộ nhớ cục bộ của Instance 2, Instance 1 sẽ không nhận được sự kiện để đẩy xuống stream của User A.

### Giải pháp kỹ thuật khi mở rộng nhiều instance (Chưa triển khai trong giai đoạn này):
1. **PostgreSQL `LISTEN / NOTIFY` (Khuyến nghị cho SaaS quy mô vừa):**
   - Tận dụng cơ sở dữ liệu PostgreSQL đã có sẵn.
   - Khi `NotificationsService.create()` ghi bản ghi thông báo vào DB, trigger hoặc service gọi lệnh:
     `NOTIFY notification_channel, '{"tenantId":"...", "userId":...}'`.
   - Mỗi instance API chạy `LISTEN notification_channel` qua một dedicated connection và phát lại cho các client nội bộ.
2. **Redis Pub/Sub (Cho hệ thống tải cực lớn):**
   - Sử dụng Redis cluster để điều phối thông điệp pub/sub giữa các instance backend.

---

## 3. Cấu hình Reverse Proxy & Nginx cho SSE

Do SSE là kết nối HTTP kéo dài liên tục (long-lived connection), các tầng proxy trung gian (như Nginx, Cloudflare, Traefik, AWS ALB) cần được cấu hình chính xác để không gom bộ đệm (buffering) hoặc ngắt kết nối quá sớm.

### Các tham số quan trọng:
- `proxy_buffering off;` — Ngăn Nginx giữ lại các chunk dữ liệu nhỏ để gom buffer.
- `proxy_read_timeout 3600s;` (hoặc tối thiểu ≥ 60s, phù hợp với heartbeat 25s của máy chủ).
- `proxy_cache off;` — Không lưu đệm kết quả stream.
- `proxy_set_header Connection '';` — Ngắt header `close` mặc định của HTTP/1.0 để giữ kết nối keep-alive.
- Header từ máy chủ: Máy chủ backend luôn trả về header `X-Accel-Buffering: no` để báo hiệu trực tiếp cho Nginx tắt bộ đệm ngay cả khi cấu hình mặc định có bật buffer.

### Đánh giá cấu hình proxy có sẵn trong kho lưu trữ:
Trong file `frontend/nginx.conf` hiện tại:
```nginx
    # Proxy /api to backend
    location /api {
        proxy_pass $api_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts for long API calls
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;
    }
```
- **Hiện trạng:**
  - `proxy_read_timeout` đã được đặt là `300s` (lớn hơn 60s và heartbeat 25s nên kết nối không bị timeout ngắt ngang).
  - Backend đã gửi header `X-Accel-Buffering: no` nên Nginx tự động tắt buffer cho stream.
  - Tuy nhiên, trong block `location /api`, chưa có khai báo `proxy_buffering off;`.

### Khuyến nghị cấu hình Nginx khi triển khai máy chủ production:
Bổ sung một khối cấu hình riêng cho SSE endpoint vào cấu hình reverse proxy:
```nginx
    # SSE Real-time Notification Stream
    location /api/notifications/stream {
        proxy_pass $api_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        chunked_transfer_encoding on;
    }
```
*(Lưu ý: Không tự ý sửa đổi file cấu hình trên server thật; đây là tài liệu hướng dẫn bàn giao cho đội ngũ DevOps/SysAdmin khi deploy).*
