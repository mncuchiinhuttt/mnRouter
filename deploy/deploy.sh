#!/usr/bin/env bash
# Deploy MNRouter lên Dell Wyse 3040 (Standalone Linux x64 Binary):
#   1. Build web SPA trên máy dev (web-dist)
#   2. Compile standalone binary (target: bun-linux-x64-baseline cho CPU Intel Atom)
#   3. Pipe binary + web-dist lên server bằng tar stream
#   4. Tự cài / restart systemd service & verify healthz
# Dùng: ./deploy/deploy.sh [user@host hoặc host alias (mặc định: my-server)]
set -euo pipefail

REMOTE="${1:-my-server}"
APP_DIR="/opt/mnrouter"

echo "==> 1. Build web frontend…"
bun run build

echo "==> 2. Compile standalone binary for Intel Atom (x64 baseline)…"
bun build --compile --target=bun-linux-x64-baseline src/server/index.ts --outfile ./mnrouter

echo "==> 3. Upload to $REMOTE…"
ssh "$REMOTE" "mkdir -p $APP_DIR/data"
tar -czf - ./mnrouter web-dist deploy | ssh "$REMOTE" "tar -xzf - -C $APP_DIR/"
ssh "$REMOTE" "chmod +x $APP_DIR/mnrouter"
rm -f ./mnrouter

echo "==> 4. Restart service & health check…"
ssh "$REMOTE" "
pkill -9 mnrouter || true
sleep 3
curl -sf http://127.0.0.1:8787/healthz && echo ''
"

echo "==> ✅ Deployed successfully! Service running on $REMOTE."
