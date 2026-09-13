#!/usr/bin/env bash
# Deploy MNRouter lên Wyse 3040: build local → rsync → migrate → restart systemd.
# Dùng: ./deploy/deploy.sh user@wyse-host
set -euo pipefail

REMOTE="${1:?Usage: ./deploy/deploy.sh user@wyse-host}"
APP_DIR="/opt/mnrouter"

echo "==> 1. build (server + web)…"
node scripts/build.mjs

echo "==> 2. rsync artifact…"
ssh "$REMOTE" "sudo mkdir -p $APP_DIR && sudo chown \$USER: $APP_DIR"
rsync -az --delete \
	--exclude 'node_modules/.pnpm-*' \
	dist web-dist package.json pnpm-lock.yaml drizzle "$REMOTE:$APP_DIR/"

echo "==> 3. install prod deps + migrate + restart…"
ssh "$REMOTE" "cd $APP_DIR && \
	pnpm install --prod --frozen-lockfile && \
	sudo systemctl restart mnrouter && \
	sleep 2 && curl -sf http://127.0.0.1:8787/healthz"

echo "==> ✅ deployed. healthz OK."
