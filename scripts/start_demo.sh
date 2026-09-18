#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "==> Starting demo environment"

# FIXED: L3
if [ "${APP_ENV:-}" != "demo" ]; then
  echo "ERROR: start_demo.sh only runs when APP_ENV=demo"
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_cmd python
require_cmd npm

if command -v ollama >/dev/null 2>&1; then
  if ! pgrep -f "ollama serve" >/dev/null 2>&1; then
    echo "==> Starting Ollama"
    nohup ollama serve >/tmp/altaria-ollama.log 2>&1 &
    sleep 2
  else
    echo "==> Ollama already running"
  fi
else
  echo "==> Ollama CLI not found (using Groq fallback if configured)"
fi

if command -v redis-cli >/dev/null 2>&1; then
  if ! redis-cli ping >/dev/null 2>&1; then
    if command -v redis-server >/dev/null 2>&1; then
      echo "==> Starting Redis"
      nohup redis-server >/tmp/altaria-redis.log 2>&1 &
      sleep 2
    else
      echo "Redis not reachable and redis-server not installed."
      exit 1
    fi
  else
    echo "==> Redis already running"
  fi
else
  echo "redis-cli not found. Ensure REDIS_URL points to a running Redis."
fi

echo "==> Running backend migrations"
cd "$BACKEND_DIR"
python -m alembic -c alembic.ini upgrade head

echo "==> Seeding demo dataset"
python -m app.db.seed

echo "==> Installing frontend dependencies"
cd "$FRONTEND_DIR"
npm install

echo "==> Starting backend"
cd "$BACKEND_DIR"
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >/tmp/altaria-backend.log 2>&1 &

echo "==> Starting frontend"
cd "$FRONTEND_DIR"
nohup npm run dev -- --host --port 5173 >/tmp/altaria-frontend.log 2>&1 &

cat <<EOF

Demo services are starting.

Frontend: http://localhost:5173
Backend:  http://localhost:8000
API Docs: http://localhost:8000/docs

Demo credentials:
admin@test.com / hackathon123
treasury@test.com / hackathon123
compliance@test.com / hackathon123
auditor@test.com / hackathon123

Logs:
/tmp/altaria-backend.log
/tmp/altaria-frontend.log
/tmp/altaria-redis.log
/tmp/altaria-ollama.log
EOF
