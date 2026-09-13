# MNRouter

**Internal AI gateway** — một cổng API duy nhất (OpenAI/Anthropic-compatible) phía trước các tài khoản OAuth thật: **Claude (Claude Code OAuth)**, **ChatGPT/Codex**, **Google Antigravity/Gemini**, **AWS Kiro**. Chạy nhẹ trên Dell Wyse 3040 (Debian 12), không Docker, DB hosted trên Neon Postgres.

> Plan chi tiết: [PLAN.md](./PLAN.md)

## Kiến trúc (30 giây)

```
Claude Code ──/v1/messages──┐
Codex CLI ────/v1/responses─┤──► [MNRouter: Hono] ──► canonical ──► adapters ──► Claude / Codex / Antigravity / Kiro
Bất kỳ tool ──/v1/chat/…────┘        │ auth (magic link + API key)        (OAuth auto-refresh, failover, cooldown)
                                     │ usage log + budget + rate limit
                                     └─► Neon Postgres
```

- **Ingress**: `POST /v1/chat/completions` (OpenAI), `POST /v1/responses` (Codex), `POST /v1/messages` (Anthropic), `GET /v1/models` — stream + non-stream.
- **Chuẩn hoá**: mọi request dịch về canonical format rồi adapter phân phối ra wire format từng provider (tham khảo `@oh-my-pi/pi-ai`).
- **Router**: connection theo priority (`fill-first`/`round-robin`), failover tự động, cooldown/backoff per connection, refresh OAuth nền mỗi 60s, baseUrl chain (kiro: runtime → codewhisperer → q).
- **Quản lý**: chỉ admin tạo user; login bằng **magic link** (hết hạn 15 phút); session **15 ngày**; **API key do admin cấp**, user chỉ **rotate/revoke**; budget token/tháng + rate limit per key; log toàn bộ request.

## Dev local

```bash
pnpm install
cp .env.example .env          # điền DATABASE_URL (Neon hoặc Postgres local)
pnpm db:migrate               # tạo bảng
pnpm bootstrap admin@you.dev  # tạo admin đầu tiên (DB rỗng)
pnpm dev                      # server :8787 + web :5173 (proxy sẵn)
```

Magic link chạy dev (chưa set SMTP_PASS) sẽ **in link vào console** — bấm là login, không cần mail thật.

## Test

```bash
pnpm test        # unit: converters 3 ingress + 4 provider parsers + keys (vitest)
pnpm test:e2e    # e2e: postgres tạm + mock 4 upstream + server thật (40+ assertions)
```

E2e tự dựng Postgres ở `/tmp/mnrouter-e2e-pg` (cần `initdb` của Homebrew Postgres).

## Smoke với provider thật

```bash
# import connections từ 9router đang có trên máy
DATABASE_URL=... pnpm import-9router
# chạy server rồi:
SMOKE_KEY=mr_... SMOKE_BASE=http://127.0.0.1:8787 pnpm tsx scripts/smoke-real.ts claude-sonnet-4.5-kiro
```

## Deploy lên Wyse 3040

1. Tạo user + dir: `sudo useradd -r mnrouter && sudo mkdir -p /opt/mnrouter`
2. `/etc/mnrouter.env` (mode 600) — xem `.env.example`; `NODE_ENV=production`, `APP_URL=https://router.mncuchiinhuttt.dev`
3. Copy `deploy/mnrouter.service` → `/etc/systemd/system/`, `systemctl enable --now mnrouter`
4. Cài Caddy, copy `deploy/Caddyfile` → `/etc/caddy/Caddyfile`, trỏ DNS A record của `router.mncuchiinhuttt.dev` về IP Wyse, `systemctl reload caddy` (TLS tự động)
5. Deploy mỗi lần cập nhật: `./deploy/deploy.sh user@wyse-host` (build ở máy dev, rsync artifact — không build trên Wyse)

## Bảo mật — ghi nhớ nhanh

- API key/session/magic-link **chỉ lưu SHA-256 hash** trong DB; key hiện plaintext đúng 1 lần lúc tạo/rotate.
- Cookie session `httpOnly + Secure + SameSite=Lax`.
- ClientId OAuth là client không chính thức của từng CLI (kiểu 9router/OMP) — rủi ro bị provider đổi; adapter là data-driven nên sửa nhanh (`src/server/gateway/registry.ts`).
- Antigravity/Kiro đang bị 9router đánh dấu RISK — ưu tiên thấp trong routing mặc định.
