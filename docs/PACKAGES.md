# Các Gói Tính Năng ERP4U (Modular Packages)

ERP4U được tổ chức theo kiến trúc **Modular Monolith + Entitlement**: một codebase duy nhất cho phép bật hoặc tắt từng gói tính năng theo cấu hình của hệ thống (tenant), giúp bản self-host/demo dùng trọn bộ và bản triển khai thương mại kích hoạt linh hoạt theo nhu cầu doanh nghiệp.

---

## 1. Bảng gói tính năng & phụ thuộc

| Mã gói (`PackageKey`) | Tên gói | Chức năng chính | Module backend | Phụ thuộc |
|---|---|---|---|---|
| `CORE` | Cơ bản (Core) | Đăng nhập, phân quyền RBAC, người dùng, cấu hình hệ thống, danh mục sản phẩm/khách hàng/NCC, thông báo, công việc chung, tải tệp | `auth`, `users`, `system`, `common`, `categories`, `customers`, `suppliers`, `products`, `notifications`, `announcements`, `tasks`, `upload`, `utils` | *(Bắt buộc — luôn bật)* |
| `SALES` | Bán hàng & CRM | Quản lý Lead, báo giá, đơn hàng (SO), bảng giá, khuyến mãi, POS, giao hàng bán ra, cổng báo giá khách hàng | `sales` | `CORE` |
| `INVENTORY` | Kho & Mua hàng | Tồn kho, nhập/xuất kho, kho hàng mẫu, nguyên phụ liệu, đơn mua hàng (PO), đối tác gia công, vận chuyển | `inventory`, `purchasing`, `materials`, `shipping` | `CORE` |
| `PRODUCTION` | Sản xuất | Định mức nguyên vật liệu (BOM), công đoạn & quy trình, lập kế hoạch sản xuất (MRP/PFO), lệnh sản xuất, kiểm tra chất lượng (QC) | `bom`, `processes`, `planning`, `production`, `qc` | `INVENTORY` |
| `DESIGN` | Thiết kế in/thêu | Quản lý logo khách hàng, thiết kế in ấn & thêu, mẫu in, đơn hàng thiết kế | `designs` | `SALES` |
| `FINANCE` | Tài chính | Thu/chi, phân loại giao dịch, báo cáo dòng tiền, theo dõi công nợ | `finance` | `CORE` |
| `HR` | Nhân sự | Hồ sơ nhân viên, ca làm việc, chấm công, nghỉ phép, bảng lương, tuyển dụng, đánh giá nhân sự | `hr` | `CORE` |
| `PROJECTS` | Dự án | Quản lý dự án, cột mốc (milestone), thảo luận nội bộ theo dự án | `projects`, `discussions` | `CORE` |
| `MARKETING` | Marketing & Omnichannel | Chiến dịch marketing, phân khúc khách hàng, kênh bán hàng Social/TikTok, Zalo ZNS, bài viết/blog, website & thống kê truy cập | `marketing`, `social`, `tiktok`, `zns`, `blogs`, `website-projects`, `analytics`, `public` | `SALES` |
| `AI` | AI Assistant | Trợ lý AI gợi ý nghiệp vụ (không tự quyết định thay con người), hộp thư & kịch bản Chatbot AI | `ai`, `chatbot` | `CORE` |

> **Lưu ý về phụ thuộc gói:** Khi một gói phụ thuộc vào gói khác (ví dụ `PRODUCTION` phụ thuộc `INVENTORY`, `DESIGN` và `MARKETING` phụ thuộc `SALES`), gói phụ thuộc chỉ hoạt động hiệu quả khi gói nền tảng cũng đang được kích hoạt. Nếu gói nền tảng bị tắt hoặc hết hạn, hệ thống tự động coi gói phụ thuộc là chưa kích hoạt.

---

## 2. Chế độ cấu hình `ENTITLEMENTS_MODE`

Biến môi trường `ENTITLEMENTS_MODE` điều khiển cách backend kiểm tra quyền sử dụng gói:

- **`ENTITLEMENTS_MODE=all`** *(mặc định — dùng cho bản demo & self-host)*:
  - Sử dụng `AllEnabledProvider`.
  - Mọi gói tính năng đều ở trạng thái bật; toàn bộ API, cron job và menu hoạt động bình thường.
- **`ENTITLEMENTS_MODE=db`**:
  - Sử dụng `DbEntitlementProvider`, đọc trạng thái kích hoạt từ bảng PostgreSQL `tenant_entitlement` (cache trong bộ nhớ 60 giây).
  - Gói `CORE` luôn bật bất kể bản ghi trong DB.
  - Các gói khác chỉ bật khi có bản ghi `enabled = true`, chưa quá `valid_until` (hoặc `valid_until IS NULL`), và toàn bộ gói phụ thuộc đều đang bật.
  - Các tác vụ chạy nền (cron/webhook/listener) thuộc gói tắt sẽ tự động bỏ qua.

Frontend sau khi đăng nhập sẽ gọi `GET /api/me/entitlements` một lần và lưu trong bộ nhớ để:
- Ẩn các mục menu thuộc gói chưa kích hoạt (kết hợp cùng quyền RBAC hiện có).
- Khi truy cập trực tiếp đường dẫn của gói chưa bật, hiển thị trang thông báo liên hệ quản trị viên để nâng cấp.
- Nếu API `/api/me/entitlements` gặp lỗi mạng hoặc lỗi máy chủ tạm thời (5xx), frontend mặc định không tự khóa giao diện; mọi bảo vệ thực thi cuối cùng vẫn do backend kiểm soát.

---

## 3. Cách bật gói trong chế độ `db`

Khi chạy với `ENTITLEMENTS_MODE=db`, quản trị viên kích hoạt gói bằng cách chèn hoặc cập nhật bản ghi trong bảng `tenant_entitlement`.

Ví dụ bật gói **Bán hàng & CRM (`SALES`)**, **Kho & Mua hàng (`INVENTORY`)** và **Sản xuất (`PRODUCTION`)** cho tenant mặc định (`default`) với dữ liệu mẫu:

```sql
INSERT INTO tenant_entitlement (tenant_id, package_key, enabled, valid_until, limits)
VALUES
  ('default', 'SALES', true, '2099-12-31T23:59:59Z', NULL),
  ('default', 'INVENTORY', true, '2099-12-31T23:59:59Z', NULL),
  ('default', 'PRODUCTION', true, '2099-12-31T23:59:59Z', NULL)
ON CONFLICT (tenant_id, package_key)
DO UPDATE SET
  enabled = EXCLUDED.enabled,
  valid_until = EXCLUDED.valid_until,
  limits = EXCLUDED.limits,
  updated_at = NOW();
```

Ví dụ tắt tạm thời một gói (chẳng hạn `PRODUCTION`):

```sql
UPDATE tenant_entitlement
SET enabled = false, updated_at = NOW()
WHERE tenant_id = 'default' AND package_key = 'PRODUCTION';
```

> Vì `DbEntitlementProvider` cache 60 giây, thay đổi trong cơ sở dữ liệu sẽ có hiệu lực tối đa sau 60 giây (hoặc ngay lập tức khi khởi động lại backend).

---

## 4. Mã lỗi HTTP `402` (`PACKAGE_REQUIRED`)

Khi gọi API thuộc một gói chưa được kích hoạt trong chế độ `ENTITLEMENTS_MODE=db`, `EntitlementGuard` ở backend sẽ từ chối yêu cầu với HTTP status **`402 Payment Required`** và cấu trúc JSON chuẩn:

```json
{
  "statusCode": 402,
  "code": "PACKAGE_REQUIRED",
  "package": "PRODUCTION",
  "message": "Tính năng thuộc gói PRODUCTION chưa được kích hoạt"
}
```

- Trường `code`: luôn là `"PACKAGE_REQUIRED"` để client phân biệt rõ với các lỗi khác.
- Trường `package`: mã `PackageKey` yêu cầu bởi endpoint.
- Phía frontend có axios interceptor bắt `status === 402` cùng `code === 'PACKAGE_REQUIRED'` để hiển thị thông báo thân thiện bằng tên gói tiếng Việt; các trang portal công khai (`/portal/*`) cũng hiển thị thông báo tương ứng khi nhận mã 402.
