#!/usr/bin/env bash
# One-command production deploy without editing APP_TAG in .env.
#
#   ./scripts/deploy.sh             backup -> remember running commit -> pull latest -> restart
#   ./scripts/deploy.sh rollback    go back to the commit running before the last deploy
#   ./scripts/deploy.sh status      show running commit, web commit, and DB schema info
#   ./scripts/deploy.sh seed [-y]   run database reset and demo seed via tools container
#
# APP_TAG and TOOLS_TAG are passed on the command line (shell env beats .env in compose),
# so .env is never edited or read in this script.
set -euo pipefail

PROJECT="${PROJECT:-erp4u-demo}"
COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.prod.yml}"
STATE_DIR="${STATE_DIR:-.deploy}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-240}"
APP_CONTAINER="${PROJECT}-backend-1"
WEB_CONTAINER="${PROJECT}-web-1"

# shellcheck disable=SC2086
dc() { docker compose -p "$PROJECT" $COMPOSE_FILES "$@"; }

log() { echo "$(date '+%H:%M:%S') $*"; }
die() { echo "LỖI: $*" >&2; exit 1; }

running_revision() {
  docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
    "$APP_CONTAINER" 2>/dev/null | cut -c1-7
}

web_running_revision() {
  docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
    "$WEB_CONTAINER" 2>/dev/null | cut -c1-7
}

# In số bảng trong public schema (thay cho migration vì demo dùng TypeORM synchronize)
# Lưu ý: Rollback với synchronize: true có thể xoá hoặc làm lệch cột mà bản cũ không biết.
# Luôn chạy backup trước khi deploy (bước 1/5) và kiểm thử rollback trên staging trước khi tin tưởng.
schema_info() {
  local tables
  # shellcheck disable=SC2016
  tables="$(dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select count(*) from pg_tables where schemaname = current_schema()"' < /dev/null 2>/dev/null || true)"
  echo "${tables:-không rõ} bảng (public schema)"
}

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
  dc logs web --tail 40 < /dev/null || true
  return 1
}

# Start stack với tag chỉ định ("" = latest) và kiểm tra healthcheck
start_tag() {
  local tag="$1" tools_tag
  if [ -n "$tag" ]; then
    tools_tag="tools-$tag"
  else
    tools_tag="tools-latest"
  fi

  # Explicit `|| return 1`: set -e does not apply inside a function called from `if !`.
  APP_TAG="$tag" TOOLS_TAG="$tools_tag" dc pull backend web < /dev/null || {
    log "không kéo được image backend hoặc web (${tag:-latest})"
    return 1
  }

  APP_TAG="$tag" TOOLS_TAG="$tools_tag" dc --profile tools pull seed < /dev/null || {
    log "(không kéo được image tools – bỏ qua)"
  }

  APP_TAG="$tag" TOOLS_TAG="$tools_tag" dc up -d < /dev/null || return 1
  wait_healthy || return 1

  local app_rev web_rev
  app_rev="$(running_revision)"
  web_rev="$(web_running_revision)"
  if [ -n "$app_rev" ] && [ -n "$web_rev" ] && [ "$app_rev" != "$web_rev" ]; then
    log "CẢNH BÁO: Revision backend ($app_rev) và web ($web_rev) không khớp!"
  fi
}

show_status() {
  local app_rev web_rev
  app_rev="$(running_revision)"
  web_rev="$(web_running_revision)"
  echo "Backend đang chạy : ${app_rev:-không rõ (container chưa chạy hoặc image chưa có nhãn)}"
  echo "Web đang chạy     : ${web_rev:-không rõ}"
  echo "origin/main       : $(git rev-parse --short=7 origin/main 2>/dev/null || echo '?') (lệch -> CI commit mới chưa xong hoặc đỏ)"
  echo "Database schema   : $(schema_info)"
  [ -f "$STATE_DIR/previous" ] && echo "Bản trước (rollback): $(cat "$STATE_DIR/previous")"
  return 0
}

cmd_seed() {
  local force=false
  for arg in "$@"; do
    case "$arg" in
      -y|--yes|--force) force=true ;;
    esac
  done

  if [ "$force" != "true" ]; then
    echo "CẢNH BÁO: Lệnh này sẽ xoá toàn bộ dữ liệu và nạp lại dữ liệu demo (seed:reset)!"
    read -r -p "Bạn có chắc chắn muốn thực hiện? [y/N]: " confirm
    case "$confirm" in
      [yY]|[yY][eE][sS]) ;;
      *) log "Đã huỷ thao tác seed."; return 0 ;;
    esac
  fi

  local rev tools_tag
  rev="$(running_revision)"
  if [ -n "$rev" ]; then
    tools_tag="tools-sha-$rev"
  else
    tools_tag="tools-latest"
  fi

  log "Đang chạy seed:reset qua container tools (TOOLS_TAG=$tools_tag)..."
  TOOLS_TAG="$tools_tag" dc --profile tools run --rm seed < /dev/null
  log "Seed dữ liệu hoàn tất."
}

cmd_deploy() {
  [ -z "$(git status --porcelain --untracked-files=no)" ] ||
    die "thư mục có file đã sửa (git status). Xử lý xong rồi chạy lại – script không tự xoá thay đổi."

  log "1/5 Backup DB + uploads"
  ./scripts/backup.sh

  log "2/5 Ghi lại bản đang chạy để rollback"
  mkdir -p "$STATE_DIR"
  chmod 700 "$STATE_DIR"
  local prev older=""
  prev="$(running_revision)"
  [ -f "$STATE_DIR/previous" ] && older="$(cat "$STATE_DIR/previous")"
  if [ -n "$prev" ]; then
    echo "$prev" > "$STATE_DIR/previous"
    log "bản đang chạy: $prev"
  else
    log "không đọc được commit đang chạy (bản cũ chưa có nhãn) – rollback sẽ cần nhập tay APP_TAG"
  fi

  log "3/5 Lấy file compose / script mới"
  git pull --ff-only < /dev/null

  log "4/5 Kéo image latest và khởi động lại"
  if ! start_tag ""; then
    die "bản mới không lên. Chạy: ./scripts/deploy.sh rollback"
  fi

  local now
  now="$(running_revision)"
  # Nothing new on latest: keep the earlier rollback point instead of "rollback to itself".
  if [ -n "$now" ] && [ "$now" = "$prev" ] && [ -n "$older" ]; then
    echo "$older" > "$STATE_DIR/previous"
    log "latest vẫn là $now (không có bản mới) – giữ mốc rollback $older"
  fi
  echo "$(date -Is) deploy ${prev:-?} -> ${now:-?}" >> "$STATE_DIR/history.log"

  log "5/5 Kiểm tra"
  show_status
  log "Deploy xong. Mở trang chủ để kiểm tra."
}

cmd_rollback() {
  [ -f "$STATE_DIR/previous" ] ||
    die "chưa có $STATE_DIR/previous. Rollback tay: APP_TAG=sha-<7 ký tự> docker compose -p $PROJECT $COMPOSE_FILES up -d"
  local prev now
  prev="$(cat "$STATE_DIR/previous")"
  [[ "$prev" =~ ^[0-9a-f]{7}$ ]] || die "$STATE_DIR/previous không hợp lệ: $prev"
  now="$(running_revision)"
  log "Quay về sha-$prev (đang chạy: ${now:-?})"
  log "Lưu ý: schema của bản mới vẫn còn trong DB (bản cũ có thể bỏ qua cột/bảng thừa)."
  log "Nếu dữ liệu bị ảnh hưởng: khôi phục backup theo hướng dẫn trong docs/DEPLOY.md."
  start_tag "sha-$prev" || die "bản sha-$prev cũng không lên – xem log ở trên."
  echo "$(date -Is) rollback ${now:-?} -> $prev" >> "$STATE_DIR/history.log"
  log "Đã quay về sha-$prev. Bản này chạy với APP_TAG truyền qua lệnh;"
  log "lần deploy sau (./scripts/deploy.sh) sẽ lên lại latest."
  show_status
}

case "${1:-deploy}" in
  deploy) cmd_deploy ;;
  rollback) cmd_rollback ;;
  status) show_status ;;
  seed) shift; cmd_seed "$@" ;;
  *) die "lệnh không hợp lệ: $1 (deploy | rollback | status | seed)" ;;
esac
