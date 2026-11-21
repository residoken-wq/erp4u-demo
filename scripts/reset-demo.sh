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
trap 'echo "LỖI: dừng ở dòng $LINENO (lệnh: $BASH_COMMAND)" >&2' ERR

PROJECT="${PROJECT:-erp4u-demo}"
COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.prod.yml}"
APP_CONTAINER="${PROJECT}-backend-1"
WEB_CONTAINER="${PROJECT}-web-1"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-240}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck disable=SC2086
dc() { docker compose -p "$PROJECT" $COMPOSE_FILES "$@"; }

log() { echo "$(date '+%H:%M:%S') $*"; }

run_backup() {
  if [ -x "$SCRIPT_DIR/backup.sh" ]; then
    "$SCRIPT_DIR/backup.sh"
  elif [ -f "$SCRIPT_DIR/backup.sh" ]; then
    bash "$SCRIPT_DIR/backup.sh"
  elif [ -x "./scripts/backup.sh" ]; then
    ./scripts/backup.sh
  elif [ -f "./scripts/backup.sh" ]; then
    bash ./scripts/backup.sh
  else
    echo "LỖI: không tìm thấy script backup.sh" >&2
    exit 1
  fi
}

run_seed() {
  if [ -x "$SCRIPT_DIR/deploy.sh" ]; then
    "$SCRIPT_DIR/deploy.sh" seed --yes
  elif [ -f "$SCRIPT_DIR/deploy.sh" ]; then
    bash "$SCRIPT_DIR/deploy.sh" seed --yes
  elif [ -x "./scripts/deploy.sh" ]; then
    ./scripts/deploy.sh seed --yes
  elif [ -f "./scripts/deploy.sh" ]; then
    bash ./scripts/deploy.sh seed --yes
  else
    echo "LỖI: không tìm thấy script deploy.sh" >&2
    exit 1
  fi
}

if [ -z "$(dc ps -q --status running postgres 2>/dev/null || true)" ]; then
  echo "LỖI: chưa có stack, chạy ./scripts/deploy.sh trước" >&2
  exit 1
fi

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
run_backup

log "2/5 Dừng backend và dựng lại cơ sở dữ liệu rỗng"
dc stop backend < /dev/null
# shellcheck disable=SC2016
dc exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --if-exists --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"' < /dev/null

log "3/5 Khởi động backend để tự chạy TypeORM migrations (DB_AUTO_MIGRATE) và chờ healthy"
dc up -d backend < /dev/null
wait_healthy

log "4/5 Nạp dữ liệu demo qua container seed (seed:reset) và xử lý thư mục uploads"
run_seed
log "Uploads: Đã kiểm tra (chưa cấu hình xoá cưỡng chế uploads ngoài manifest)"

log "5/5 Khởi động lại backend sau seed và chờ healthy"
dc restart backend < /dev/null
wait_healthy

log "=== RESET DEMO HOÀN TẤT THÀNH CÔNG ==="
