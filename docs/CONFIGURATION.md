# Cấu hình hệ thống ERP4U (Hạ tầng vs Theo Tenant)

Tài liệu này phân loại toàn bộ biến cấu hình trong `src/` theo kiến trúc mở rộng đa tenant (P7b2):

- **Hạ tầng (Infrastructure)**: Dùng chung cho toàn bộ tiến trình/cụm máy chủ; tiếp tục đọc từ biến môi trường (`process.env` / `ConfigService`).
- **Theo tenant (Per-Tenant)**: Tích hợp riêng của từng doanh nghiệp; đọc từ schema riêng của tenant thông qua `TenantConfigService` (bảng `system_configs` hoặc `zalo_api_configs` trong schema tenant).
  - Fallback sang biến môi trường **chỉ áp dụng khi tenant là `default`** (giữ tương thích single-tenant / self-host / demo).
  - Với mọi tenant khác (`tenantId !== 'default'`), nếu thiếu cấu hình trong schema tenant sẽ trả về `undefined` (hoặc ném lỗi qua `getRequired`) — **không bao giờ** rò biến môi trường dùng chung sang tenant khác.
  - Cache trong RAM được tách riêng theo `tenantId` với TTL mặc định 30 giây (≤ 60 giây) và tự động xoá cache khi gọi `set()`.
  - Các khoá bí mật (`*_PASS`, `*_PASSWORD`, `*_SECRET`, `*_TOKEN`, `*_API_KEY`, `*_PRIVATE_KEY`) được mã hoá AES-256-GCM qua `EncryptionService` / `EncryptionTransformer` trước khi lưu DB và tự động giải mã khi đọc (tương thích ngược với giá trị plaintext cũ).

> Lưu ý: Tài liệu chỉ ghi **tên biến**, không ghi bất kỳ giá trị thật hay giá trị bí mật nào.

---

## 1. Bảng phân loại biến môi trường trong `src/`

### 1.1. Biến Hạ tầng (giữ nguyên đọc từ env, dùng chung mọi tenant)

| Tên biến | File sử dụng (`src/`) | Loại | Ghi chú |
| --- | --- | --- | --- |
| `NODE_ENV` | `src/erp4u-core.module.ts`, `src/common/services/email.service.ts`, `src/common/utils/cors.util.ts` *(cùng `src/main.ts`, `src/database/data-source.ts`)* | Hạ tầng | Chế độ môi trường (`development` / `production` / `test`) |
| `DATABASE_URL` | `src/erp4u-core.module.ts` *(cùng `src/database/data-source.ts`)* | Hạ tầng | Chuỗi kết nối PostgreSQL |
| `POSTGRES_URL` | `src/erp4u-core.module.ts` *(cùng `src/database/data-source.ts`)* | Hạ tầng | Alias chuỗi kết nối PostgreSQL |
| `DB_HOST` | `src/erp4u-core.module.ts` *(cùng `src/database/data-source.ts`)* | Hạ tầng | Host PostgreSQL |
| `DB_PORT` | `src/erp4u-core.module.ts` *(cùng `src/database/data-source.ts`)* | Hạ tầng | Cổng PostgreSQL |
| `DB_USERNAME` | `src/erp4u-core.module.ts` *(cùng `src/database/data-source.ts`)* | Hạ tầng | Tài khoản PostgreSQL |
| `DB_PASSWORD` | `src/erp4u-core.module.ts` *(cùng `src/database/data-source.ts`)* | Hạ tầng | Mật khẩu PostgreSQL (bắt buộc ở `production`) |
| `DB_DATABASE` | `src/erp4u-core.module.ts` *(cùng `src/database/data-source.ts`)* | Hạ tầng | Tên database PostgreSQL |
| `DB_AUTO_MIGRATE` | `src/erp4u-core.module.ts` | Hạ tầng | Tự chạy TypeORM migrations khi boot (`true` / `false`) |
| `PORT` | `src/main.ts` | Hạ tầng | Cổng HTTP server |
| `CORS_ORIGINS` | `src/main.ts` | Hạ tầng | Danh sách origin cho phép CORS |
| `JWT_SECRET` | `src/auth/jwt.strategy.ts` | Hạ tầng | Khoá ký/xác thực JWT |
| `ENCRYPTION_KEY` | `src/common/encryption/encryption.service.ts`, `src/common/encryption/encryption.transformer.ts` | Hạ tầng | Khoá chủ AES-256-GCM mã hoá PII và cấu hình bí mật |
| `DEMO_MODE` | `src/common/services/demo-mode.service.ts` | Hạ tầng | Chặn gọi API/email/ZNS ra ngoài ở bản demo |
| `ENTITLEMENTS_MODE` | `src/common/packages/entitlements.module.ts`, `src/common/packages/me-entitlements.controller.ts` | Hạ tầng | Chế độ kiểm gói tính năng (`all` / `db`) |
| `TENANCY_STRICT` | `src/common/tenancy/tenant-context.ts` | Hạ tầng | Fail-fast khi truy cập `TenantContext.current()` ngoài ngữ cảnh tenant |
| `PUBLIC_APP_URL` | `src/common/utils/url.util.ts`, `src/hr/hr.service.ts` | Hạ tầng | URL công khai mặc định của ứng dụng (portal báo giá, tuyển dụng) |
| `CHATBOT_TEST_HOOKS` | `src/chatbot/conversation/chatbot-conversation.service.ts`, `src/chatbot/conversation/turn-orchestrator.service.ts`, `src/chatbot/llm/fake.provider.ts` | Hạ tầng (Test flag) | Cờ bật hook mô phỏng lỗi/độ trễ khi chạy kiểm thử tự động |
| `CHATBOT_FAKE_MODE` | `src/chatbot/llm/fake.provider.ts` | Hạ tầng (Test flag) | Chế độ giả lập phản hồi của `FakeProvider` trong unit test |
| `CHATBOT_ALLOW_FIXTURES` | `src/chatbot/kb/chatbot-kb.service.ts` | Hạ tầng (Test flag) | Cho phép xuất bản dữ liệu fixture kiểm thử của chatbot KB |

---

### 1.2. Biến Theo tenant (đọc qua `TenantConfigService`, chỉ fallback env cho tenant `default`)

| Tên biến | File sử dụng (`src/`) | Nhóm tích hợp | Bí mật (Mã hoá) | Lưu trữ theo tenant |
| --- | --- | --- | --- | --- |
| `SMTP_HOST` | `src/common/services/email.service.ts`, `src/system/system.service.ts` | SMTP / Email | Không | `system_configs` |
| `SMTP_PORT` | `src/common/services/email.service.ts`, `src/system/system.service.ts` | SMTP / Email | Không | `system_configs` |
| `SMTP_USER` | `src/common/services/email.service.ts`, `src/system/system.service.ts` | SMTP / Email | Không | `system_configs` |
| `SMTP_PASS` | `src/common/services/email.service.ts`, `src/system/system.service.ts` | SMTP / Email | **Có** | `system_configs` (AES-256-GCM) |
| `SMTP_FROM_NAME` | `src/common/services/email.service.ts`, `src/system/system.service.ts` | SMTP / Email | Không | `system_configs` |
| `SMTP_FROM_EMAIL` | `src/common/services/email.service.ts`, `src/system/system.service.ts` | SMTP / Email | Không | `system_configs` |
| `SMTP_FROM` | `src/common/services/email.service.ts` | SMTP / Email (env alias) | Không | Fallback env cho `SMTP_FROM_EMAIL` (chỉ tenant `default`) |
| `SMTP_SECURE` | `src/common/services/email.service.ts`, `src/system/system.service.ts` | SMTP / Email | Không | `system_configs` |
| `EASYINVOICE_URL` | `src/system/system.service.ts`, `src/sales/easyinvoice.service.ts` | EasyInvoice | Không | `system_configs` (không fallback env) |
| `EASYINVOICE_USERNAME` | `src/system/system.service.ts`, `src/sales/easyinvoice.service.ts` | EasyInvoice | Không | `system_configs` |
| `EASYINVOICE_PASSWORD` | `src/system/system.service.ts`, `src/sales/easyinvoice.service.ts` | EasyInvoice | **Có** | `system_configs` (AES-256-GCM) |
| `EASYINVOICE_TAX_CODE` | `src/system/system.service.ts`, `src/sales/easyinvoice.service.ts` | EasyInvoice | Không | `system_configs` |
| `EASYINVOICE_PATTERN` | `src/system/system.service.ts`, `src/sales/easyinvoice.service.ts` | EasyInvoice | Không | `system_configs` |
| `EASYINVOICE_SERIAL` | `src/system/system.service.ts`, `src/sales/easyinvoice.service.ts` | EasyInvoice | Không | `system_configs` |
| `EASYINVOICE_EMAIL_FROM` | `src/system/system.service.ts`, `src/sales/sales.service.ts` | EasyInvoice | Không | `system_configs` |
| `EASYINVOICE_EMAIL_CC` | `src/system/system.service.ts`, `src/sales/sales.service.ts` | EasyInvoice | Không | `system_configs` |
| `ZALO_APP_ID` | `src/zns/zns.service.ts` | Zalo / ZNS | Không | `zalo_api_configs` (init từ `TenantConfigService`) |
| `ZALO_APP_SECRET` | `src/zns/zns.service.ts` | Zalo / ZNS | **Có** | `zalo_api_configs.secret_key` (AES-256-GCM) |
| `ZALO_OA_ID` | `src/zns/zns.service.ts` | Zalo / ZNS | Không | `zalo_api_configs` |
| `ZALO_ACCESS_TOKEN` | `src/zns/zns.service.ts` | Zalo / ZNS | **Có** | `zalo_api_configs.access_token` (AES-256-GCM) |
| `ZALO_REFRESH_TOKEN` | `src/zns/zns.service.ts` | Zalo / ZNS | **Có** | `zalo_api_configs.refresh_token` (AES-256-GCM) |
| `TIKTOK_APP_KEY` | `src/tiktok/tiktok-api.client.ts` | TikTok Shop | Không | `system_configs` via `TenantConfigService` |
| `TIKTOK_APP_SECRET` | `src/tiktok/tiktok-api.client.ts` | TikTok Shop | **Có** | `system_configs` via `TenantConfigService` |
| `TIKTOK_REDIRECT_URI` | `src/tiktok/tiktok-api.client.ts` | TikTok Shop | Không | `system_configs` via `TenantConfigService` |
| `TIKTOK_AUTH_URL` | `src/tiktok/tiktok-api.client.ts` | TikTok Shop | Không | `system_configs` via `TenantConfigService` |
| `TIKTOK_API_BASE_URL` | `src/tiktok/tiktok-api.client.ts` | TikTok Shop | Không | `system_configs` via `TenantConfigService` |
| `GHTK_SANDBOX` | `src/shipping/carriers/ghtk.service.ts` | Vận chuyển GHTK | Không | `system_configs` via `TenantConfigService` |
| `GHTK_ENVIRONMENT` | `src/shipping/carriers/ghtk.service.ts` | Vận chuyển GHTK | Không | `system_configs` via `TenantConfigService` |
| `GHTK_API_URL` | `src/shipping/carriers/ghtk.service.ts` | Vận chuyển GHTK | Không | `system_configs` via `TenantConfigService` |
| `GHTK_TOKEN` | `src/shipping/carriers/ghtk.service.ts` | Vận chuyển GHTK | **Có** | `system_configs` (AES-256-GCM) |
| `GHTK_API_TOKEN` | `src/shipping/carriers/ghtk.service.ts` | Vận chuyển GHTK (alias) | **Có** | `system_configs` (AES-256-GCM) |
| `GHTK_PARTNER_CODE` | `src/shipping/carriers/ghtk.service.ts` | Vận chuyển GHTK | Không | `system_configs` via `TenantConfigService` |
| `GHTK_CLIENT_SOURCE` | `src/shipping/carriers/ghtk.service.ts` | Vận chuyển GHTK (alias) | Không | `system_configs` via `TenantConfigService` |
| `GHTK_DEFAULT_PICK_ADDRESS_ID` | `src/shipping/carriers/ghtk.service.ts` | Vận chuyển GHTK | Không | `system_configs` via `TenantConfigService` |
| `GHTK_DEFAULT_PICK_OPTION` | `src/shipping/carriers/ghtk.service.ts` | Vận chuyển GHTK | Không | `system_configs` via `TenantConfigService` |
| `LALAMOVE_API_KEY` | `src/shipping/carriers/lalamove.service.ts` | Vận chuyển Lalamove | **Có** | `system_configs` (AES-256-GCM) |
| `LALAMOVE_API_SECRET` | `src/shipping/carriers/lalamove.service.ts` | Vận chuyển Lalamove | **Có** | `system_configs` (AES-256-GCM) |
| `LALAMOVE_SANDBOX` | `src/shipping/carriers/lalamove.service.ts` | Vận chuyển Lalamove | Không | `system_configs` via `TenantConfigService` |
| `LALAMOVE_ENVIRONMENT` | `src/shipping/carriers/lalamove.service.ts` | Vận chuyển Lalamove | Không | `system_configs` via `TenantConfigService` |
| `LALAMOVE_API_URL` | `src/shipping/carriers/lalamove.service.ts` | Vận chuyển Lalamove | Không | `system_configs` via `TenantConfigService` |
| `LALAMOVE_MARKET` | `src/shipping/carriers/lalamove.service.ts` | Vận chuyển Lalamove | Không | `system_configs` via `TenantConfigService` |
| `LALAMOVE_DEFAULT_PICK_ADDRESS` | `src/shipping/carriers/lalamove.service.ts` | Vận chuyển Lalamove | Không | `system_configs` via `TenantConfigService` |
| `LALAMOVE_DEFAULT_PICK_LAT` | `src/shipping/carriers/lalamove.service.ts` | Vận chuyển Lalamove | Không | `system_configs` via `TenantConfigService` |
| `LALAMOVE_DEFAULT_PICK_LNG` | `src/shipping/carriers/lalamove.service.ts` | Vận chuyển Lalamove | Không | `system_configs` via `TenantConfigService` |
| `LALAMOVE_DEFAULT_SENDER_NAME` | `src/shipping/carriers/lalamove.service.ts` | Vận chuyển Lalamove | Không | `system_configs` via `TenantConfigService` |
| `LALAMOVE_DEFAULT_SENDER_PHONE` | `src/shipping/carriers/lalamove.service.ts` | Vận chuyển Lalamove | Không | `system_configs` via `TenantConfigService` |
| `GEMINI_API_KEY` | `src/ai/ai.service.ts`, `src/chatbot/llm/gemini.provider.ts`, `src/chatbot/controllers/chatbot-admin-config.controller.ts`, `src/chatbot/chatbot.module.ts` | AI / Gemini | **Có** | `system_configs` (AES-256-GCM) |
| `CHATBOT_LLM_API_KEY` | `src/chatbot/llm/gemini.provider.ts`, `src/chatbot/controllers/chatbot-admin-config.controller.ts`, `src/chatbot/chatbot.module.ts` | Chatbot AI | **Có** | `system_configs` (AES-256-GCM) |
| `CHATBOT_LLM_PROVIDER` | `src/chatbot/chatbot.module.ts`, `src/chatbot/controllers/chatbot-admin-config.controller.ts`, `src/chatbot/conversation/turn-orchestrator.service.ts` | Chatbot AI | Không | `system_configs` via `TenantConfigService` |
| `CHATBOT_LLM_MODEL` | `src/chatbot/llm/gemini.provider.ts`, `src/chatbot/controllers/chatbot-admin-config.controller.ts` | Chatbot AI | Không | `system_configs` via `TenantConfigService` |
| `ERP_PUBLIC_URL` | `src/chatbot/outbox/chatbot-outbox.service.ts` | Chatbot Outbox | Không | `system_configs` via `TenantConfigService` (fallback `PUBLIC_APP_URL` cho tenant `default`) |
| `FIREBASE_*` *(dự kiến)* | *(chưa khởi tạo runtime trong `src/`, mới có dependency `firebase-admin` trong `package.json`)* | Firebase / Push | **Có** (`FIREBASE_PRIVATE_KEY`, `FIREBASE_API_KEY`) | Khi kích hoạt sẽ đọc qua `TenantConfigService` theo từng tenant |

---

## 2. Lưu trữ tệp tin (`FileStorage`)

- Token DI: `FILE_STORAGE` (`src/common/storage/file-storage.interface.ts`).
- Triển khai mặc định: `LocalFileStorage` (`src/common/storage/local-file-storage.service.ts`), lưu trong thư mục `/uploads`.
- Quy tắc tiền tố key theo tenant (`scopeKeyForTenant`):
  - Tenant `default`: **không thêm tiền tố** (`<filename>` → URL `/uploads/<filename>`) để giữ tương thích ngược hoàn toàn với dữ liệu demo/self-host hiện có.
  - Tenant khác (`tenantId !== 'default'`): tự động gắn tiền tố `<tenantId>/` (`<tenantId>/<filename>` → URL `/uploads/<tenantId>/<filename>`). Tenant B không thể đọc/liệt kê/xoá tệp của Tenant A.
- Bản SaaS (`erp4u-cloud`) có thể truyền implementation S3/MinIO qua `Erp4uCoreModule.forRoot({ fileStorage })`.

---

## 3. Điểm cắm mở rộng (`Erp4uCoreModule.forRoot`)

`AppModule` gọi `Erp4uCoreModule.forRoot()` với đầy đủ cấu hình mặc định cho single-tenant. Bản private SaaS (P7c) có thể nạp plugin và thay thế các provider chuẩn:

```ts
Erp4uCoreModule.forRoot({
  plugins: [PlatformModule, BillingModule],
  tenantResolver: SubdomainTenantResolver,
  tenantRegistry: PlatformTenantRegistry,
  entitlementProvider: SaasEntitlementProvider,
  fileStorage: S3FileStorage,
})
```
