#!/usr/bin/env bash
# Start/stop/status for the local FireSight monorepo stack.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT/.pids"
LOG_DIR="$ROOT/.logs"

export PATH="${HOME}/.local/bin:${PATH}"
export LD_LIBRARY_PATH="${HOME}/.local/lib/ollama${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"

SERVICES=(ollama coordinator worker web)

mkdir -p "$PID_DIR" "$LOG_DIR"

usage() {
  cat <<'EOF'
Usage: scripts/dev.sh <up|down|status|logs> [service]

  up              Start Ollama, coordinator, worker, and web
  down            Stop services started by this script
  status          Show PIDs and health checks
  logs [service]  Tail all logs, or one of: ollama coordinator worker web
EOF
}

is_listening() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -tln 2>/dev/null | grep -qE ":${port}\\b"
  else
    curl -sf --max-time 1 "http://127.0.0.1:${port}/" >/dev/null 2>&1
  fi
}

pid_alive() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

read_pid() {
  local name="$1"
  local file="$PID_DIR/${name}.pid"
  if [[ -f "$file" ]]; then
    tr -d '[:space:]' <"$file"
  fi
}

write_pid() {
  local name="$1"
  local pid="$2"
  echo "$pid" >"$PID_DIR/${name}.pid"
}

wait_http() {
  local name="$1"
  local url="$2"
  local timeout="${3:-120}"
  local i
  for ((i = 1; i <= timeout; i++)); do
    if curl -sf --max-time 2 "$url" >/dev/null 2>&1; then
      echo "  ${name}: ready (${url})"
      return 0
    fi
    sleep 1
  done
  echo "  ${name}: timed out waiting for ${url}" >&2
  return 1
}

start_ollama() {
  if is_listening 11434; then
    echo "Ollama already listening on :11434"
    return 0
  fi
  if ! command -v ollama >/dev/null 2>&1; then
    echo "error: ollama not found on PATH (expected ~/.local/bin/ollama)" >&2
    exit 1
  fi
  echo "Starting ollama..."
  nohup ollama serve >"$LOG_DIR/ollama.log" 2>&1 &
  write_pid ollama $!
  wait_http ollama "http://127.0.0.1:11434/api/tags" 60
}

start_coordinator() {
  local dir="$ROOT/apps/coordinator"
  if [[ ! -x "$dir/.venv/bin/python" ]]; then
    echo "error: missing $dir/.venv/bin/python — create the venv and pip install -r requirements.txt" >&2
    exit 1
  fi
  if is_listening 8080; then
    echo "Coordinator already listening on :8080"
    return 0
  fi
  echo "Starting coordinator..."
  (
    cd "$dir"
    nohup .venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8080 \
      >"$LOG_DIR/coordinator.log" 2>&1 &
    echo $! >"$PID_DIR/coordinator.pid"
  )
  wait_http coordinator "http://127.0.0.1:8080/health" 60
}

start_worker() {
  local dir="$ROOT/apps/worker"
  if [[ ! -x "$dir/.venv/bin/python" ]]; then
    echo "error: missing $dir/.venv/bin/python — create the venv and pip install -r requirements.txt" >&2
    exit 1
  fi
  if is_listening 8000; then
    echo "Worker already listening on :8000"
    return 0
  fi
  echo "Starting worker (Whisper may take a while on first load)..."
  (
    cd "$dir"
    nohup .venv/bin/python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 \
      >"$LOG_DIR/worker.log" 2>&1 &
    echo $! >"$PID_DIR/worker.pid"
  )
  wait_http worker "http://127.0.0.1:8000/health" 180
}

start_web() {
  local dir="$ROOT/apps/web"
  if [[ ! -d "$dir/node_modules" ]]; then
    echo "error: missing $dir/node_modules — run npm install in apps/web" >&2
    exit 1
  fi
  if is_listening 5173; then
    echo "Web already listening on :5173"
    return 0
  fi
  echo "Starting web..."
  (
    cd "$dir"
    nohup npm run dev -- --host 0.0.0.0 --port 5173 \
      >"$LOG_DIR/web.log" 2>&1 &
    echo $! >"$PID_DIR/web.pid"
  )
  wait_http web "http://127.0.0.1:5173/" 60
}

cmd_up() {
  start_ollama
  start_coordinator
  start_worker
  start_web
  echo
  echo "FireSight local stack is up:"
  echo "  Web          http://localhost:5173"
  echo "  Coordinator  http://localhost:8080"
  echo "  Worker       http://localhost:8000"
  echo "  Ollama       http://localhost:11434"
  echo
  echo "Stop with: make down"
}

stop_one() {
  local name="$1"
  local pid
  pid="$(read_pid "$name" || true)"
  if pid_alive "$pid"; then
    echo "Stopping ${name} (pid ${pid})..."
    kill "$pid" 2>/dev/null || true
    # uvicorn --reload / npm spawn children; try process group
    kill -- -"$pid" 2>/dev/null || true
    sleep 0.5
    if pid_alive "$pid"; then
      kill -9 "$pid" 2>/dev/null || true
      kill -9 -- -"$pid" 2>/dev/null || true
    fi
  else
    echo "${name}: not running via this script"
  fi
  rm -f "$PID_DIR/${name}.pid"
}

cmd_down() {
  # reverse order
  stop_one web
  stop_one worker
  stop_one coordinator
  stop_one ollama
  # Best-effort cleanup of reload children still holding ports
  for port in 5173 8000 8080; do
    if is_listening "$port"; then
      local pids
      pids="$(ss -tlnp 2>/dev/null | awk -v p=":${port}" '$4 ~ p {print}' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u || true)"
      if [[ -n "${pids:-}" ]]; then
        echo "Freeing port ${port}: ${pids}"
        # shellcheck disable=SC2086
        kill $pids 2>/dev/null || true
      fi
    fi
  done
  echo "Stack stopped."
}

health_line() {
  local name="$1"
  local url="$2"
  if curl -sf --max-time 2 "$url" >/dev/null 2>&1; then
    echo "  ${name}: OK  ${url}"
  else
    echo "  ${name}: DOWN ${url}"
  fi
}

cmd_status() {
  echo "PIDs:"
  local name pid
  for name in "${SERVICES[@]}"; do
    pid="$(read_pid "$name" || true)"
    if pid_alive "$pid"; then
      echo "  ${name}: ${pid} (alive)"
    elif [[ -n "${pid:-}" ]]; then
      echo "  ${name}: ${pid} (stale pid file)"
    else
      echo "  ${name}: (no pid file)"
    fi
  done
  echo "Health:"
  health_line ollama "http://127.0.0.1:11434/api/tags"
  health_line coordinator "http://127.0.0.1:8080/health"
  health_line worker "http://127.0.0.1:8000/health"
  health_line web "http://127.0.0.1:5173/"
}

cmd_logs() {
  local target="${1:-}"
  if [[ -n "$target" ]]; then
    local file="$LOG_DIR/${target}.log"
    if [[ ! -f "$file" ]]; then
      echo "error: no log at $file" >&2
      exit 1
    fi
    exec tail -n 100 -f "$file"
  fi
  local files=()
  local name
  for name in "${SERVICES[@]}"; do
    [[ -f "$LOG_DIR/${name}.log" ]] && files+=("$LOG_DIR/${name}.log")
  done
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "No log files yet under $LOG_DIR"
    exit 0
  fi
  exec tail -n 50 -f "${files[@]}"
}

main() {
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    up) cmd_up "$@" ;;
    down) cmd_down "$@" ;;
    status) cmd_status "$@" ;;
    logs) cmd_logs "$@" ;;
    -h|--help|help|"") usage; [[ -n "$cmd" ]] || exit 1 ;;
    *) echo "Unknown command: $cmd" >&2; usage; exit 1 ;;
  esac
}

main "$@"
