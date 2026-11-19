#!/usr/bin/env bash
# Nightly reset of the demo environment:
# 1. Quick backup
# 2. Recreate clean database (drop & create)
# 3. Start backend so TypeORM auto-migrations (DB_AUTO_MIGRATE) initialize schema, then wait healthy
# 4. Seed demo data & permissions via tools container (seed:reset) and check uploads
# 5. Restart backend & verify health
#
# Crontab (02:30 every day):
#   30 2 * * * cd /opt/erp4u-demo && ./scripts/reset-demo.sh >> /var/log/erp4u-reset-demo.log 2>&1
set -euo pipefail

PROJECT="${PROJECT:-erp4u-demo}"
COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.prod.yml}"
APP_CONTAINER="${PROJECT}-backend-1"
WEB_CONTAINER="${PROJECT}-web-1"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-240}"

# shellcheck disable=SC2086
dc() { docker compose -p "$PROJECT" $COMPOSE_FILES "$@"; }

log() { echo "$(date '+%H:%M:%S') $*"; }

wait_healthy() {
  local waited=0 app_state web_state
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    app_state="$(docker inspect --format '{{.State.Health.Status}}' "$APP_CONTAINER" 2>/dev/null || echo missing)"
    web_state="$(docker inspect --format '{{.State.Health.Status}}' "$WEB_CONTAINER" 2>/dev/null || echo missing)"

    if [ "$app_state" = "healthy" ] && [ "$web_state" = "healthy" ]; then
      log "backend và web healthy sau ${waited}s"
      return 0
    fi

    if [ "$app_state" = "unhealthy" ] || [ "$web_state" = "unhealthy" ]; then
      break
    fi

    sleep 5
    waited=$((waited + 5))
  done

  log "dịch vụ chưa healthy sau ${waited}s (backend: ${app_state:-?}, web: ${web_state:-?}). Log 80 dòng cuối:"
  dc logs backend --tail 80 < /dev/null || true
  return 1
}

log "=== BẮT ĐẦU RESET DEMO ==="

log "1/5 Tạo bản backup trước khi reset"
./scripts/backup.sh

log "2/5 Dừng backend và dựng lại cơ sở dữ liệu rỗng"
dc stop backend < /dev/null
# shellcheck disable=SC2016
dc exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"' < /dev/null

log "3/5 Khởi động backend để tự chạy TypeORM migrations (DB_AUTO_MIGRATE) và chờ healthy"
dc up -d backend < /dev/null
wait_healthy

log "4/5 Nạp dữ liệu demo qua container seed (seed:reset) và xử lý thư mục uploads"
./scripts/deploy.sh seed --yes
# TODO: Hiện tại bộ dữ liệu seed không kèm ảnh tĩnh vào volume /app/uploads.
# Khi có danh sách file ảnh seed trong tương lai, xác định qua manifest và chỉ xoá file người dùng tạo ra.
# Để tránh mất dữ liệu do đoán mò, không thực hiện xoá tuỳ tiện ở đây.
log "Uploads: Đã kiểm tra (chưa cấu hình xoá cưỡng chế uploads ngoài manifest)"

log "5/5 Khởi động lại backend sau seed và chờ healthy"
dc restart backend < /dev/null
wait_healthy

log "=== RESET DEMO HOÀN TẤT THÀNH CÔNG ==="
