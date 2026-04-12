#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/backend-dev.log"
PID_FILE="$SCRIPT_DIR/backend.pid"
HOST="127.0.0.1"
PORT="3000"
HEALTH_URL="http://${HOST}:${PORT}/health"
STARTUP_TIMEOUT=30

mkdir -p "$LOG_DIR"

stop_existing_processes() {
  echo "🛑 停止当前后端服务..."

  if [[ -f "$PID_FILE" ]]; then
    local existing_pid
    existing_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [[ -n "${existing_pid}" ]] && ps -p "$existing_pid" > /dev/null 2>&1; then
      kill -TERM "$existing_pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi

  local port_pids
  port_pids="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
  if [[ -n "$port_pids" ]]; then
    while IFS= read -r pid; do
      [[ -n "$pid" ]] || continue
      kill -TERM "$pid" 2>/dev/null || true
    done <<< "$port_pids"
  fi

  local wait_count=0
  while lsof -i tcp:"$PORT" > /dev/null 2>&1; do
    wait_count=$((wait_count + 1))
    if [[ "$wait_count" -ge 10 ]]; then
      echo "⚠️ 端口 ${PORT} 仍被占用，尝试强制结束相关进程..."
      while IFS= read -r pid; do
        [[ -n "$pid" ]] || continue
        kill -KILL "$pid" 2>/dev/null || true
      done <<< "$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
      break
    fi
    sleep 1
  done
}

start_backend() {
  echo "🚀 启动后端服务..."
  : > "$LOG_FILE"

  (
    cd "$SCRIPT_DIR"
    nohup node server.js >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
  )

  local backend_pid
  backend_pid="$(cat "$PID_FILE")"
  echo "📝 启动日志: $LOG_FILE"
  echo "🧾 PID 文件: $PID_FILE"

  local elapsed=0
  while [[ "$elapsed" -lt "$STARTUP_TIMEOUT" ]]; do
    if ! ps -p "$backend_pid" > /dev/null 2>&1; then
      echo "❌ 后端进程已退出，启动失败"
      tail -n 80 "$LOG_FILE" || true
      exit 1
    fi

    if curl -s "$HEALTH_URL" > /dev/null 2>&1; then
      echo ""
      echo "✅ 后端服务已启动 (PID: $backend_pid)"
      echo ""
      echo "📊 服务状态:"
      echo "  ✅ 健康检查通过: $HEALTH_URL"
      echo "  ✅ 端口 ${PORT} 正在监听"
      echo ""
      echo "✅ 重启完成！"
      return 0
    fi

    sleep 1
    elapsed=$((elapsed + 1))
  done

  echo "❌ 等待后端健康检查超时 (${STARTUP_TIMEOUT}s)"
  tail -n 80 "$LOG_FILE" || true
  exit 1
}

stop_existing_processes
start_backend
