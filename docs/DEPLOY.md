# Hướng dẫn Triển khai Production ERP4U Demo trên VPS

Tài liệu này hướng dẫn chi tiết quy trình triển khai, vận hành, sao lưu và khôi phục hệ thống **ERP4U Demo** trên môi trường VPS Ubuntu/Debian.

---

## 1. Kiến trúc Hệ thống & Luồng Truy cập

```
[Người dùng truy cập]
         │
         ▼
https://erp4u-demo.conix.cloud
         │
         ▼ (HTTPS: 443 / Let's Encrypt)
[VPS Nginx Proxy Manager (NPM)]
         │
         ▼ (HTTP: port 3201 qua Internet hoặc Private Network)
[VPS Chạy ERP4U Demo]
         │
         ▼ (Port 3201:80)
┌─────────────────────────────────────────────────────────────┐
│ Docker Compose Stack: erp4u-demo                            │
│                                                             │
│ ┌───────────────────────────┐   Proxy /api, /uploads       │
│ │ web: Nginx (SPA Frontend) │ ─────────────────────────┐    │
│ └───────────────────────────┘                          │    │
│                                                        ▼    │
│                                          ┌────────────────┐ │
│                                          │ backend: NestJS│ │
│                                          └───────┬────────┘ │
│                                                  │          │
│                                                  ▼          │
│                                          ┌────────────────┐ │
│                                          │ postgres: DB   │ │
│                                          └────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

- **VPS NPM**: Tiếp nhận HTTPS, quản trị chứng chỉ SSL Let's Encrypt, chuyển tiếp yêu cầu đến `<IP_VPS_APP>:3201`.
- **VPS App**: Chạy Docker Compose `docker-compose.prod.yml`, chỉ publish duy nhất port `3201` của container `web`. Database Postgres và Backend API chạy trong mạng nội bộ Docker, không mở port ra Internet.

---

## 2. Chuẩn bị VPS Ứng dụng

### 2.1. Cài đặt Docker & Docker Compose Plugin
Cài đặt Docker Engine và Docker Compose plugin chính thức (Ubuntu):
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 2.2. Clone mã nguồn
Clone mã nguồn vào thư mục `/opt/erp4u-demo`:
```bash
sudo mkdir -p /opt/erp4u-demo
sudo chown -R $USER:$USER /opt/erp4u-demo
git clone https://github.com/residoken-wq/erp4u-demo.git /opt/erp4u-demo
cd /opt/erp4u-demo
chmod +x scripts/*.sh
```

### 2.3. Khởi tạo cấu hình môi trường (.env)
Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
chmod 600 .env
```

Chỉnh sửa `.env` và thiết lập các biến bắt buộc:
1. `POSTGRES_PASSWORD`: Mật khẩu cơ sở dữ liệu ngẫu nhiên mạnh.
2. `JWT_SECRET`: Khóa ký JWT (bắt buộc ở production, ≥32 ký tự, tạo bằng `openssl rand -hex 32`).
3. `ENCRYPTION_KEY`: Khóa mã hóa AES-256 dữ liệu nhạy cảm PII (bắt buộc ở production, ≥32 ký tự, tạo bằng `openssl rand -hex 32`).
4. `DEMO_MODE=true`: Bật chế độ demo để cô lập và bảo vệ dữ liệu.
5. `CORS_ORIGINS=https://erp4u-demo.conix.cloud`: Giới hạn origin được gọi API.
6. `PUBLIC_APP_URL=https://erp4u-demo.conix.cloud`: URL truy cập công khai.

> **Cảnh báo bảo mật**: `JWT_SECRET` và `ENCRYPTION_KEY` bắt buộc ở production, ≥32 ký tự, tạo bằng `openssl rand -hex 32`. Sau khi cập nhật, mọi phiên đăng nhập cũ hết hiệu lực — người dùng đăng nhập lại.

> **Lưu ý quan trọng**: Tuyệt đối **không** khai báo biến `APP_TAG` trong `.env`. Script `scripts/deploy.sh` sẽ tự động quản lý biến này.

---

## 3. Triển khai Lần đầu (First Deploy)

### 3.1. Đăng nhập GitHub Container Registry (GHCR)
Nếu package/image trên GHCR được đặt ở chế độ private:
```bash
echo "<GITHUB_PERSONAL_ACCESS_TOKEN>" | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin
```

### 3.2. Khởi chạy hệ thống
Chạy script triển khai chính:
```bash
./scripts/deploy.sh
```
Script sẽ tự động:
1. Sao lưu (bỏ qua nếu stack chưa chạy).
2. Kéo image `latest` từ GHCR về VPS.
3. Khởi chạy toàn bộ dịch vụ backend, web, postgres.
4. Chờ healthcheck xác nhận dịch vụ sẵn sàng.

### 3.3. Nạp dữ liệu mẫu ban đầu (Seed Database)
Sau khi container postgres và backend đã healthy, nạp bộ dữ liệu mẫu và phân quyền demo:
```bash
./scripts/deploy.sh seed
```
Nhập `y` để xác nhận. Lệnh này sử dụng container phụ trợ `seed` (target build tools) để chạy `npm run seed:reset`.

---

## 4. Thiết lập Lịch Tự động (Crontab)

Thiết lập crontab cho tài khoản chạy dịch vụ:
```bash
crontab -e
```

Thêm 2 dòng sau:
```cron
# Sao lưu dữ liệu định kỳ mỗi ngày lúc 03:15 sáng (giữ bản sao lưu trong 7 ngày)
15 3 * * * cd /opt/erp4u-demo && ./scripts/backup.sh >> /var/log/erp4u-backup.log 2>&1

# Reset làm sạch môi trường demo mỗi đêm lúc 02:30 sáng (backup -> seed:reset -> restart)
30 2 * * * cd /opt/erp4u-demo && ./scripts/reset-demo.sh >> /var/log/erp4u-reset-demo.log 2>&1
```

---

## 5. Vận hành & Cập nhật Phiên bản

### 5.1. Cập nhật bản mới (Deploy update)
Khi có commit mới trên branch `main`, GitHub Actions CI sẽ tự động build và push image mới với tag `latest` và `sha-<commit>`.
Trên VPS, chỉ cần chạy một lệnh duy nhất:
```bash
./scripts/deploy.sh
```
Quy trình thực hiện:
- Tự động tạo bản backup DB và media hiện tại.
- Lưu lại commit SHA đang chạy vào `.deploy/previous`.
- Thực hiện `git pull --ff-only` lấy mã nguồn script/compose mới.
- Kéo image `latest` mới nhất và khởi động lại container.
- Chờ container vượt qua health check thành công.

### 5.2. Kiểm tra trạng thái hệ thống
```bash
./scripts/deploy.sh status
```
Hiển thị commit SHA của backend, web, `origin/main`, tên migration mới nhất trong bảng `migrations` và mốc rollback khả dụng.

### 5.3. Quay lại phiên bản trước (Rollback)
Nếu phiên bản mới phát sinh lỗi, thực hiện rollback:
```bash
./scripts/deploy.sh rollback
```
Hệ thống sẽ kéo và chạy lại chính xác tag `sha-<commit>` trước đó được lưu trong `.deploy/previous`.

> **Lưu ý về Migrations khi Rollback**: Rollback chỉ quay lại image ứng dụng cũ và **không** tự động revert migration trong cơ sở dữ liệu. Vì vậy migration mới vẫn nằm trong DB khi bản cũ chạy lại — mọi migration mới cần thiết kế **tương thích ngược** (ví dụ: thêm cột nullable trước khi dùng, chưa vội `DROP COLUMN` ngay trong cùng phiên bản). Nếu cần quay về trạng thái schema/dữ liệu cũ hoàn toàn, hãy khôi phục từ bản sao lưu ở mục 6.

### 5.4. Migrations (TypeORM)

Hệ thống tắt hoàn toàn `synchronize` (`synchronize: false`) và quản lý thay đổi schema bằng TypeORM migrations (`src/database/migrations/`, bảng theo dõi `migrations`).

#### Cơ chế tự chạy khi khởi động
- Mặc định `DB_AUTO_MIGRATE=true` (khi không khai báo hoặc khác `false`): mỗi khi container `backend` khởi động, TypeORM tự động chạy mọi migration chưa áp dụng (`migrationsRun: true`) trước khi ứng dụng nhận request.

#### Tắt tự chạy và chạy tay qua image tools
Nếu muốn kiểm soát thời điểm chạy migration trước khi nâng cấp backend:
1. Đặt `DB_AUTO_MIGRATE=false` trong file `.env`.
2. Chạy migration thủ công bằng image tools (`seed` service trong profile `tools`):
   ```bash
   # Xem danh sách migration đã chạy / chờ chạy
   docker compose -p erp4u-demo -f docker-compose.prod.yml --profile tools run --rm seed npm run migration:show

   # Chạy các migration mới
   docker compose -p erp4u-demo -f docker-compose.prod.yml --profile tools run --rm seed npm run migration:run

   # Hoàn tác migration gần nhất (chỉ dùng khi đã kiểm tra ảnh hưởng dữ liệu)
   docker compose -p erp4u-demo -f docker-compose.prod.yml --profile tools run --rm seed npm run migration:revert
   ```
   *(Với image runtime đã build sẵn `dist/`, lệnh tương đương là `npm run migration:run:prod`.)*

#### Ảnh hưởng khi Rollback
- Khi chạy `./scripts/deploy.sh rollback`, container `backend` chạy lại image cũ trong khi các migration của bản mới **vẫn tồn tại trong DB**.
- Để rollback không làm sập bản cũ, các migration phải theo nguyên tắc **expand-and-contract (tương thích ngược)**: chỉ thêm bảng/cột nullable hoặc cột có `DEFAULT` ở bản mới; chỉ xoá/đổi tên cột cũ ở một đợt phát hành sau khi bản cũ không còn được rollback về nữa.

#### Chuyển đổi DB demo có sẵn (trước đây do `synchronize: true` tạo)
Với VPS demo đang có sẵn bảng do `synchronize: true` tạo (chưa có bảng `migrations`), nếu khởi động ngay bản mới, migration baseline sẽ báo lỗi vì các bảng đã tồn tại. Có 2 cách xử lý:

1. **Cách khuyến nghị (dựng lại từ đầu — phù hợp môi trường demo)**:
   Chạy script reset demo sau khi kéo image mới:
   ```bash
   ./scripts/reset-demo.sh
   ```
   Script sẽ tự sao lưu, xoá và tạo lại DB rỗng, khởi động backend để tự chạy toàn bộ migrations từ đầu (`DB_AUTO_MIGRATE`), rồi nạp lại dữ liệu demo (`seed:reset`).

2. **Cách giữ nguyên dữ liệu hiện có (đánh dấu baseline đã chạy)**:
   Tạo bảng `migrations` (nếu chưa có) và chèn sẵn bản ghi của baseline (`1795101604548-Baseline.ts` → tên class `Baseline1795101604548`, timestamp `1795101604548`) trước khi khởi động backend bản mới:
   ```bash
   docker compose -p erp4u-demo -f docker-compose.prod.yml exec -T postgres \
     sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
   CREATE TABLE IF NOT EXISTS "migrations" (
     "id" SERIAL NOT NULL,
     "timestamp" bigint NOT NULL,
     "name" character varying NOT NULL,
     CONSTRAINT "PK_migrations" PRIMARY KEY ("id")
   );
   INSERT INTO "migrations" ("timestamp", "name")
   SELECT 1795101604548, 'Baseline1795101604548'
   WHERE NOT EXISTS (
     SELECT 1 FROM "migrations" WHERE "name" = 'Baseline1795101604548'
   );
   SQL
   ```
   Sau bước này, khởi động lại backend (`./scripts/deploy.sh`) sẽ bỏ qua `Baseline1795101604548` và chỉ chạy các migration mới phát sinh về sau.

---

## 6. Sao lưu & Khôi phục Dữ liệu (Backup & Restore)

### 6.1. Sao lưu thủ công
```bash
./scripts/backup.sh
```
Bản sao lưu được lưu tại thư mục `/opt/erp4u-demo-backups/<YYYYMMDD-HHMMSS>` bao gồm:
- `database.dump`: Dump Postgres định dạng custom (`pg_dump -Fc`).
- `uploads.tar.gz`: Toàn bộ tệp đính kèm người dùng tải lên.
- `SHA256SUMS`: Checksum xác thực toàn vẹn dữ liệu.
- Các bản sao lưu cũ hơn 7 ngày sẽ tự động được thu dọn xoay vòng.

### 6.2. Khôi phục từ bản sao lưu
Khi cần khôi phục lại cơ sở dữ liệu:
```bash
# 1. Dừng backend để tránh xung đột ghi dữ liệu
docker compose -p erp4u-demo -f docker-compose.prod.yml stop backend

# 2. Phục hồi cơ sở dữ liệu từ file dump
docker compose -p erp4u-demo -f docker-compose.prod.yml exec -T postgres sh -c \
  'dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB" && pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < /opt/erp4u-demo-backups/<TIMESTAMP>/database.dump

# 3. Phục hồi thư mục uploads
tar -xzf /opt/erp4u-demo-backups/<TIMESTAMP>/uploads.tar.gz -C /var/lib/docker/volumes/erp4u-demo_uploads/_data/

# 4. Khởi động lại backend
docker compose -p erp4u-demo -f docker-compose.prod.yml start backend
```

---

## 7. Cấu hình Nginx Proxy Manager (NPM)

Trên giao diện web quản trị của Nginx Proxy Manager (chạy tại VPS reverse proxy):

1. **Proxy Hosts** -> **Add Proxy Host**:
   - **Details tab**:
     - **Domain Names**: `erp4u-demo.conix.cloud`
     - **Scheme**: `http`
     - **Forward Hostname / IP**: `<IP_VPS_APP>`
     - **Forward Port**: `3201`
     - **Cache Assets**: Tắt (Off)
     - **Block Common Exploits**: Bật (On)
     - **Websockets Support**: Bật (On)
   - **SSL tab**:
     - **SSL Certificate**: Request a new SSL Certificate
     - **Force SSL**: Bật (On)
     - **HTTP/2 Support**: Bật (On)
     - **HSTS Enabled**: Bật (On)
     - **I Agree to the Let's Encrypt Terms of Service**: Bật (On)
   - **Advanced tab**:
     Dán cấu hình tăng giới hạn tải tệp:
     ```nginx
     client_max_body_size 50m;
     ```
2. Bấm **Save**.

---

## 8. Cấu hình DNS

Trên trang quản lý DNS của domain `conix.cloud`:
- **Loại bản ghi**: `A`
- **Tên (Host)**: `erp4u-demo`
- **Giá trị (Value)**: `<IP_VPS_NPM>`
- **TTL**: 300 (hoặc Auto)

---

## 9. Cấu hình Tường lửa (Firewall VPS Ứng dụng)

### 9.1. Giới hạn truy cập cổng 3201 qua DOCKER-USER chain
> **CẢNH BÁO QUAN TRỌNG**: Docker tự động thao tác iptables và mặc định **bỏ qua UFW** đối với các cổng được publish. Do đó, nếu chỉ dùng `ufw deny 3201`, cổng 3201 vẫn sẽ bị lộ ra toàn bộ Internet.

Để chỉ cho phép VPS NPM kết nối tới port 3201 và chặn tất cả các IP khác từ bên ngoài, cấu hình trực tiếp vào chain `DOCKER-USER`:

```bash
# Thêm rule chặn tất cả kết nối tới port 3201 ngoại trừ từ IP của VPS NPM
sudo iptables -I DOCKER-USER -p tcp --dport 3201 ! -s <IP_VPS_NPM> -j DROP
```

### 9.2. Lưu rule iptables vĩnh viễn (Persistent)
Cài đặt gói lưu iptables để các rule không bị mất sau khi khởi động lại VPS:
```bash
sudo apt-get install -y iptables-persistent netfilter-persistent
sudo netfilter-persistent save
```

### 9.3. Kiểm tra kiểm chứng tường lửa
1. **Từ máy tính bên ngoài (hoặc máy cá nhân)**:
   ```bash
   curl -I --connect-timeout 5 http://<IP_VPS_APP>:3201
   ```
   *Kết quả mong đợi*: Bị treo (Timeout) hoặc Connection Refused. Không truy cập được.
2. **Từ chính VPS NPM**:
   ```bash
   curl -I http://<IP_VPS_APP>:3201
   ```
   *Kết quả mong đợi*: Nhận được HTTP response (200 OK hoặc chuyển hướng).

### 9.4. Lưu ý Nâng cấp Sau (WireGuard VPN)
Lưu lượng truyền giữa VPS NPM và VPS App đi qua giao thức HTTP trên môi trường mạng Internet.
- **Khuyến nghị 1**: Nếu cả hai VPS nằm cùng một nhà cung cấp hạ tầng (ví dụ Hetzner, DigitalOcean, Linode), hãy sử dụng địa chỉ IP mạng riêng nội bộ (Private IP / VPC) trong cấu hình NPM Forward Hostname.
- **Khuyến nghị 2 (Nâng cấp sau)**: Nếu hai VPS khác nhà cung cấp hạ tầng, nên thiết lập một kết nối VPN WireGuard mã hóa đường truyền point-to-point giữa VPS NPM và VPS App để bảo mật tối đa lưu lượng backend.
