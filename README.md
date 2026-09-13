# MNRouter

**Internal AI gateway** — một cổng API duy nhất (OpenAI/Anthropic-compatible) phía trước các tài khoản OAuth thật: **Claude (Claude Code OAuth)**, **ChatGPT/Codex**, **Google Antigravity/Gemini**, **AWS Kiro**. Chạy trên **Bun runtime** — nhẹ tối đa cho Dell Wyse 3040 (Debian 12), không Docker, DB hosted trên Neon Postgres.

> Plan chi tiết: [PLAN.md](./PLAN.md)

## Kiến trúc (30 giây)

```
Claude Code ──/v1/messages──┐
Codex CLI ────/v1/responses─┤──► [MNRouter: Hono trên Bun.serve] ──► canonical ──► adapters ──► Claude / Codex / Antigravity / Kiro
Bất kỳ tool ──/v1/chat/…────┘        │ auth (magic link + API key)        (OAuth auto-refresh, failover, cooldown)
                                     │ usage log + budget + rate limit
                                     └─► Neon Postgres
```

- **Ingress**: `POST /v1/chat/completions` (OpenAI), `POST /v1/responses` (Codex), `POST /v1/messages` (Anthropic), `GET /v1/models` — stream + non-stream.
- **Chuẩn hoá**: mọi request dịch về canonical format rồi adapter phân phối ra wire format từng provider (tham khảo `@oh-my-pi/pi-ai`).
- **Router**: connection theo priority (`fill-first`/`round-robin`), failover tự động + baseUrl chain (kiro: runtime → codewhisperer → q), cooldown/backoff per connection, refresh OAuth nền mỗi 60s.
- **Quản lý**: chỉ admin tạo user; login bằng **magic link** (hết hạn 15 phút); session **15 ngày**; **API key do admin cấp**, user chỉ **rotate/revoke**; budget token/tháng + rate limit per key; log toàn bộ request.

## Dev local

```bash
bun install
cp .env.example .env          # điền DATABASE_URL (Neon hoặc Postgres local)
bun run db:migrate            # tạo bảng
bun run bootstrap admin@you.dev  # tạo admin đầu tiên (DB rỗng)
bun run dev                   # server :8787 (bun --watch) + web :5173 (vite)
```

Magic link chạy dev (chưa set SMTP_PASS) sẽ **in link vào console** — bấm là login, không cần mail thật. Bun tự load `.env`.

## Test

```bash
bun run typecheck   # tsc --noEmit (bun-types)
bun test            # unit: converters 3 ingress + 4 provider parsers + keys (bun:test)
bun run test:e2e    # e2e: postgres tạm + mock 4 upstream + server thật chạy bằng bun (45+ assertions)
```

E2e tự dựng Postgres ở `/tmp/mnrouter-e2e-pg` (cần `initdb` của Homebrew Postgres).

## Smoke với provider thật

```bash
# import connections từ 9router đang có trên máy (đọc ~/.9router/db/data.sqlite)
DATABASE_URL=... bun run import-9router
# chạy server (bun run start) rồi:
SMOKE_KEY=mr_... SMOKE_BASE=http://127.0.0.1:8787 bun run smoke claude-sonnet-4.5-kiro
```

## Deploy lên Wyse 3040

1. Cài Bun trên Wyse: `curl -fsSL https://bun.sh/install | bash && sudo ln -sf ~/.bun/bin/bun /usr/local/bin/bun`
2. Tạo user + dir: `sudo useradd -r mnrouter && sudo mkdir -p /opt/mnrouter`
3. `/etc/mnrouter.env` (mode 600) — xem `.env.example`; `NODE_ENV=production`, `APP_URL=https://router.mncuchiinhuttt.dev`
4. Copy `deploy/mnrouter.service` → `/etc/systemd/system/`, `systemctl enable --now mnrouter`
5. Cài Caddy, copy `deploy/Caddyfile` → `/etc/caddy/Caddyfile`, trỏ DNS A record của `router.mncuchiinhuttt.dev` về IP Wyse, `systemctl reload caddy` (TLS tự động)
6. Deploy mỗi lần cập nhật: `./deploy/deploy.sh user@wyse-host` (build web ở máy dev, rsync source + web-dist, migrate, restart — không build trên Wyse)

Server production chạy `bun src/server/index.ts` trực tiếp (Bun chạy TS native — không cần bước build server).

## Bảo mật — ghi nhớ nhanh

- API key/session/magic-link **chỉ lưu SHA-256 hash** trong DB; key hiện plaintext đúng 1 lần lúc tạo/rotate.
- Cookie session `httpOnly + Secure + SameSite=Lax`.
- ClientId OAuth là client không chính thức của từng CLI (kiểu 9router/OMP) — rủi ro bị provider đổi; adapter là data-driven nên sửa nhanh (`src/server/gateway/registry.ts`).
- Antigravity/Kiro đang bị 9router đánh dấu RISK — ưu tiên thấp trong routing mặc định.
