#!/usr/bin/env bash
set -euo pipefail

wait_url() {
  local name="$1"
  local url="$2"
  local timeout="${3:-180}"
  local i
  for ((i = 1; i <= timeout; i++)); do
    if curl -sf --max-time 2 "$url" >/dev/null 2>&1; then
      echo "  ${name}: ready"
      return 0
    fi
    sleep 1
  done
  echo "  ${name}: timed out (${url})" >&2
  return 1
}

wait_url ollama "http://127.0.0.1:11434/api/tags" 120
wait_url coordinator "http://127.0.0.1:8080/health" 60
wait_url worker "http://127.0.0.1:8000/health" 240
wait_url web "http://127.0.0.1:5173/" 60
