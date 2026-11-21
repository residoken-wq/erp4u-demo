#!/usr/bin/env bash
set -euo pipefail
err_trap() {
  echo "LỖI: dừng ở dòng $LINENO (lệnh: $BASH_COMMAND)" >&2
}
trap err_trap ERR

# Determine repository root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Temporary directory for isolated execution
TEST_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

# Create fake docker bin
BIN_DIR="$TEST_DIR/bin"
mkdir -p "$BIN_DIR"

CMD_LOG="$TEST_DIR/docker_commands.log"
export DOCKER_CMD_LOG="$CMD_LOG"

cat > "$BIN_DIR/docker" << 'EOF'
#!/usr/bin/env bash
set -e

STATE_DIR="${TEST_STATE_DIR:-/tmp}"
CMD_LOG="${DOCKER_CMD_LOG:-$STATE_DIR/docker_commands.log}"
echo "docker $*" >> "$CMD_LOG"

# Support compose subcommand
if [ "${1:-}" = "compose" ]; then
  shift
  while [ $# -gt 0 ]; do
    case "$1" in
      -p|-f|--project-name|--file|--profile)
        shift 2
        ;;
      -*)
        shift
        ;;
      *)
        break
        ;;
    esac
  done

  subcmd="${1:-}"
  shift || true

  case "$subcmd" in
    ps)
      target=""
      while [ $# -gt 0 ]; do
        case "$1" in
          -q|--quiet|-a|--all)
            shift
            ;;
          --status)
            shift 2
            ;;
          --status=*)
            shift
            ;;
          -*)
            shift
            ;;
          *)
            target="$1"
            shift
            ;;
        esac
      done
      if [ -f "$STATE_DIR/postgres_running" ]; then
        if [ -z "$target" ] || [ "$target" = "postgres" ]; then
          echo "postgres-mock-id"
        fi
      fi
      exit 0
      ;;
    up)
      touch "$STATE_DIR/postgres_running"
      exit 0
      ;;
    pull)
      exit 0
      ;;
    run)
      is_tar=false
      for arg in "$@"; do
        if [ "$arg" = "tar" ]; then
          is_tar=true
          break
        fi
      done

      if [ "$is_tar" = "true" ]; then
        tar -czf - -T /dev/null 2>/dev/null || true
      fi
      exit 0
      ;;
    restart|start|stop)
      exit 0
      ;;
    logs)
      echo "[backend] mock backend log line 1"
      echo "[backend] mock backend log line 2"
      exit 0
      ;;
    exec)
      target=""
      while [ $# -gt 0 ]; do
        case "$1" in
          -T|-i|-t|-d)
            shift
            ;;
          -*)
            shift
            ;;
          *)
            target="$1"
            shift
            break
            ;;
        esac
      done

      if [ "$target" = "postgres" ]; then
        if [ ! -f "$STATE_DIR/postgres_running" ]; then
          echo "Error: No such container: postgres" >&2
          exit 1
        fi
        cmd_str="$*"
        if [[ "$cmd_str" == *"pg_restore"* ]]; then
          echo "1; 1234 5678 TABLE DATA public migrations"
        elif [[ "$cmd_str" == *"pg_dump"* ]]; then
          echo "mock pg_dump data"
        elif [[ "$cmd_str" == *"migrations"* ]]; then
          echo "20261120000001-init-demo.sql"
        fi
        exit 0
      fi
      exit 0
      ;;
    *)
      exit 0
      ;;
  esac
fi

if [ "${1:-}" = "inspect" ]; then
  shift
  format=""
  target=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --format)
        format="$2"
        shift 2
        ;;
      --format=*)
        format="${1#*=}"
        shift
        ;;
      -*)
        shift
        ;;
      *)
        target="$1"
        shift
        ;;
    esac
  done

  if [[ "$format" == *"Health.Status"* ]]; then
    state_file="${TEST_STATE_DIR:-/tmp}/health_${target}"
    count=0
    if [ -f "$state_file" ]; then
      count="$(cat "$state_file")"
    fi
    count=$((count + 1))
    echo "$count" > "$state_file"

    # health returns healthy starting on the 2nd call
    if [ "$count" -ge 2 ]; then
      echo "healthy"
      exit 0
    else
      echo "starting"
      exit 0
    fi
  fi

  if [[ "$format" == *"org.opencontainers.image.revision"* ]]; then
    if [ -f "${TEST_STATE_DIR:-/tmp}/postgres_running" ]; then
      echo "64b66f1"
      exit 0
    fi
  fi

  if [[ "$format" == *"RepoDigests"* ]]; then
    echo "erp4u-demo-backend@sha256:1234567890abcdef"
    exit 0
  fi

  # In initial state "no containers exist": docker inspect exits 1
  echo "Error: No such object: $target" >&2
  exit 1
fi

exit 0
EOF
chmod +x "$BIN_DIR/docker"

# Copy deploy scripts to isolated scripts/ directory in TEST_DIR
mkdir -p "$TEST_DIR/scripts"
cp "$REPO_ROOT/scripts/"*.sh "$TEST_DIR/scripts/"
chmod +x "$TEST_DIR/scripts/"*.sh

# Prepare test environment
export PATH="$BIN_DIR:$PATH"
export TEST_STATE_DIR="$TEST_DIR"
export STATE_DIR="$TEST_DIR/.deploy"
export BACKUP_ROOT="$TEST_DIR/backups"
export HEALTH_TIMEOUT=15

cd "$TEST_DIR"

echo "=== 1. Testing ./scripts/deploy.sh status (VPS trống) ==="
status_output="$(./scripts/deploy.sh status)"
echo "$status_output"

if ! echo "$status_output" | grep -iq "migration"; then
  echo "LỖI: status output không chứa 'Migration'" >&2
  exit 1
fi

if ! echo "$status_output" | grep -q "chưa có"; then
  echo "LỖI: status output không chứa 'chưa có'" >&2
  exit 1
fi
echo "PASS: deploy.sh status (VPS trống)"

echo "=== 2. Testing guards when stack is not running ==="
trap - ERR
set +e
seed_err="$(./scripts/deploy.sh seed -y 2>&1)"
seed_rc=$?
reset_demo_err="$(./scripts/reset-demo.sh 2>&1)"
reset_demo_rc=$?
backup_out="$(./scripts/backup.sh 2>&1)"
backup_rc=$?
set -e
trap err_trap ERR

if [ "$seed_rc" -eq 0 ] || ! echo "$seed_err" | grep -q "chưa có stack, chạy ./scripts/deploy.sh trước"; then
  echo "LỖI: seed phải báo lỗi rõ ràng khi chưa có stack: $seed_err" >&2
  exit 1
fi
echo "PASS: seed guard"

if [ "$reset_demo_rc" -eq 0 ] || ! echo "$reset_demo_err" | grep -q "chưa có stack, chạy ./scripts/deploy.sh trước"; then
  echo "LỖI: reset-demo.sh phải báo lỗi rõ ràng khi chưa có stack: $reset_demo_err" >&2
  exit 1
fi
echo "PASS: reset-demo.sh guard"

if [ "$backup_rc" -ne 0 ] || ! echo "$backup_out" | grep -q "chưa có stack đang chạy – bỏ qua backup"; then
  echo "LỖI: backup.sh phải bỏ qua nhẹ nhàng khi chưa có stack: $backup_out" >&2
  exit 1
fi
echo "PASS: backup.sh clean skip when stack down"

echo "=== 3. Testing ./scripts/deploy.sh (deploy first-run on empty VPS) ==="
# Reset state for clean deploy
rm -f "$TEST_DIR/postgres_running"
: > "$CMD_LOG"

deploy_output="$(./scripts/deploy.sh)"
echo "$deploy_output"

for step in "1/5" "2/5" "3/5" "4/5" "5/5"; do
  if ! echo "$deploy_output" | grep -q "$step"; then
    echo "LỖI: deploy output thiếu bước '$step'" >&2
    exit 1
  fi
done
echo "PASS: deploy.sh (all 5 steps completed)"

echo "=== 4. Testing ./scripts/deploy.sh status (stack running) ==="
running_status="$(./scripts/deploy.sh status)"
echo "$running_status"

if ! echo "$running_status" | grep -q "20261120000001-init-demo.sql"; then
  echo "LỖI: status trên stack đang chạy phải hiển thị migration thực tế" >&2
  exit 1
fi
echo "PASS: deploy.sh status (running stack)"

echo "=== 5. Testing ./scripts/deploy.sh seed -y (stack running) ==="
seed_output="$(./scripts/deploy.sh seed -y)"
echo "$seed_output"

if ! echo "$seed_output" | grep -q "Seed dữ liệu hoàn tất."; then
  echo "LỖI: seed -y output không chứa 'Seed dữ liệu hoàn tất.'" >&2
  exit 1
fi
echo "PASS: deploy.sh seed -y"

echo "=== 6. Testing ./scripts/backup.sh (stack running) ==="
backup_output="$(./scripts/backup.sh)"
echo "$backup_output"

if ! echo "$backup_output" | grep -q "backup OK"; then
  echo "LỖI: backup.sh output không chứa 'backup OK'" >&2
  exit 1
fi
echo "PASS: backup.sh (running stack)"

echo "=== 7. Testing ./scripts/reset-demo.sh (stack running) ==="
reset_demo_output="$(./scripts/reset-demo.sh)"
echo "$reset_demo_output"

if ! echo "$reset_demo_output" | grep -q "RESET DEMO HOÀN TẤT THÀNH CÔNG"; then
  echo "LỖI: reset-demo.sh output không chứa 'RESET DEMO HOÀN TẤT THÀNH CÔNG'" >&2
  exit 1
fi
echo "PASS: reset-demo.sh"

echo "=== 8. Testing ./scripts/deploy.sh rollback (stack running) ==="
echo "64b66f1" > "$STATE_DIR/previous"
rollback_output="$(./scripts/deploy.sh rollback)"
echo "$rollback_output"

if ! echo "$rollback_output" | grep -q "Đã quay về sha-64b66f1"; then
  echo "LỖI: rollback output không chứa 'Đã quay về sha-64b66f1'" >&2
  exit 1
fi
echo "PASS: deploy.sh rollback"

echo "ALL DEPLOY SCRIPT TESTS PASSED"
