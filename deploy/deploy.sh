#!/usr/bin/env bash
# Deploy MNRouter (Bun runtime + Cloudflare Tunnel) lên Wyse 3040:
#   build web ở máy dev → rsync source + web-dist → migrate → restart systemd
# Dùng: ./deploy/deploy.sh user@wyse-host
set -euo pipefail

REMOTE="${1:?Usage: ./deploy/deploy.sh user@wyse-host}"
APP_DIR="/opt/mnrouter"
BUN="/usr/local/bin/bun"

echo "==> 1. build web…"
bun run build

echo "==> 2. rsync source + web-dist…"
ssh "$REMOTE" "sudo mkdir -p $APP_DIR && sudo chown \$USER: $APP_DIR"
rsync -az --delete \
	src scripts drizzle web-dist package.json bun.lock tsconfig.json \
	"$REMOTE:$APP_DIR/"

echo "==> 3. bun install --production + migrate + restart…"
ssh "$REMOTE" "cd $APP_DIR && \
	$BUN install --production --frozen-lockfile && \
	$BUN run scripts/migrate.ts && \
	sudo systemctl restart mnrouter && \
	sleep 2 && curl -sf http://127.0.0.1:8787/healthz"

echo "==> ✅ deployed. healthz OK (Cloudflare Tunnel giữ nguyên trạng thái, không cần restart)."
