# MNRouter

**Internal AI gateway** — một cổng API duy nhất (OpenAI/Anthropic-compatible) phía trước các tài khoản OAuth thật: **Claude (Claude Code OAuth)**, **ChatGPT/Codex**, **Google Antigravity/Gemini**, **AWS Kiro**, **Grok/xAI** và **OpenCode Free**. Chạy trên **Bun runtime** — nhẹ tối đa cho Dell Wyse 3040 (Debian 12), không Docker, DB sử dụng **SQLite native (bun:sqlite)** với chế độ WAL siêu nhanh, tự động khởi tạo bảng khi khởi động.

> Plan chi tiết: [PLAN.md](./PLAN.md)

## Kiến trúc (30 giây)

```
[Client (Web / CLI / Agents)]
       │
       ▼
[1. Router & Controllers] (Hono / Ingress validation & HTTP formatting)
       │
       ▼
[2. Domain Services] (Auth, User, Invitation, Budget, Gateway, Model, Connection)
       │
       ▼
[3. Data Repositories] (UserRepository, KeyRepository, UsageRepository, etc.)
       │
       ▼
[4. SQLite Database] (bun:sqlite + WAL mode, ./data/mnrouter.db)
```

- **Ingress**: `POST /v1/chat/completions` (OpenAI), `POST /v1/responses` (Codex), `POST /v1/messages` (Anthropic), `GET /v1/models` — stream + non-stream.
- **Chuẩn hoá**: mọi request dịch về canonical format rồi adapter phân phối ra wire format từng provider (tham khảo `@oh-my-pi/pi-ai`).
- **Providers**: Claude (OAuth), ChatGPT/Codex (OAuth), Google Antigravity/Gemini (OAuth), AWS Kiro (OAuth), **Grok/xAI** (OAuth PKCE `auth.x.ai`), **OpenCode Free** (`opencode.ai/zen` — noAuth, models free xoay vòng theo tháng, xem [docs](https://opencode.ai/docs/zen/)).
- **Router**: connection theo priority (`fill-first`/`round-robin`), failover tự động + baseUrl chain (kiro: runtime → codewhisperer → q), cooldown/backoff per connection, refresh OAuth nền mỗi 60s.
- **Quản lý**: admin gửi invitation kèm package (token budget, AI credit budget, max keys, model ACL); user accept link một lần thì account mới được tạo trong DB. User tự tạo API key cho mình (trong giới hạn package) và có nút rotate/revoke; admin quản lý user, danh sách key và có quyền revoke key của user, chỉnh model/giá AI credits.

## AI Credits (bảng giá nội bộ)

1 credit = **$0.01** theo giá API niêm yết của từng nhà — budget tháng trừ theo credits nên model nào cũng so được với nhau:

```
credits = prompt/1M × priceIn + cacheRead/1M × priceCacheRead + cacheWrite/1M × priceCacheWrite + completion/1M × priceOut
```

| Model family | Provider | $/1M in | $/1M out | cr/1M in | cr/1M out |
|---|---|---:|---:|---:|---:|
| Claude Fable 5.1 | claude | $10 | $50 | 1000 | 5000 |
| Claude Opus 5 / 4.8 / 4.7 | claude/kiro | $5 | $25 | 500 | 2500 |
| Claude Sonnet 5 | claude/ag/kiro | $2 | $10 | 200 | 1000 |
| GPT-6 Astra | codex | $10 | $50 | 1000 | 5000 |
| GPT-5.6 Sol | codex/kiro | $4 | $20 | 400 | 2000 |
| GPT-5.6 Terra | codex/kiro | $2 | $12 | 200 | 1200 |
| GPT-5.6 Luna | codex/kiro | $0.20 | $1.20 | 20 | 120 |
| GPT-5.4 Mini / Nano | codex | $0.75 / $0.20 | $4.50 / $1.25 | 75 / 20 | 450 / 125 |
| Grok 4.6 / 4.5 | grok | $2 | $6 | 200 | 600 |
| Gemini 3.8 / 3.7 / 3.6 Flash | antigravity | $0.75 | $3.75 | 75 | 375 |
| Gemini 3.5 Flash | antigravity | $1.50 | $9 | 150 | 900 |
| OpenCode Zen free (Muse, Big Pickle, MiMo, Ling, Nemotron, DeepSeek) | opencode | free | free | 0 | 0 |

Sửa giá trực tiếp trong **Admin → Models → Bảng giá AI credits**. Catalog seed thêm model mới lúc boot nhưng không đè giá admin đã sửa; model Muse hiển thị tên ngắn theo OpenCode Zen nhưng wire ID dùng hậu tố chính thức `-contributor-free`.

Nguồn giá/model: [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing), [OpenAI](https://developers.openai.com/api/docs/pricing), [Google Gemini](https://ai.google.dev/gemini-api/docs/pricing), [xAI](https://docs.x.ai/developers/models), [OpenCode Zen](https://opencode.ai/docs/zen/).

## Invitations, packages và model access

- Admin mở **Users → Send invitation**, nhập email, tên package, token budget/tháng, AI credit budget/tháng, số API key tối đa và danh sách model được phép.
- Invitation hết hạn sau 7 ngày, chỉ dùng một lần. User mở link, nhập display name tuỳ chọn và accept; backend transaction tạo `users`, copy package fields, copy model ACL vào `user_models` và tạo session.
- User gọi model không nằm trong ACL nhận `403 model_forbidden` và request vẫn được ghi vào usage log.
- User vượt token budget hoặc credit budget nhận `429 budget_exceeded`. `null` là không giới hạn; giá trị `0` chặn ngay từ đầu tháng.
- User portal → **Usage** hiển thị aggregate usage và từng request với input/cache/output tokens, latency và AI credits.
- Migration mới: `drizzle/0003_add_invitation_package_name.sql`.

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
bun run test:e2e    # e2e: postgres tạm + 6 mock upstream + server thật (invitation/ACL/credits/logs)
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

**Public exposure: Cloudflare Tunnel** — IP nhà chung cư là IP động nên không mở port, không cần TLS cert local (Cloudflare đứng trước, app chỉ nghe HTTP nội bộ).

1. Cài Bun trên Wyse: `curl -fsSL https://bun.sh/install | bash && sudo ln -sf ~/.bun/bin/bun /usr/local/bin/bun`
2. Tạo user + dir: `sudo useradd -r mnrouter && sudo mkdir -p /opt/mnrouter`
3. `/etc/mnrouter.env` (mode 600) — xem `.env.example`; `NODE_ENV=production`, `APP_URL=https://router.mncuchiinhuttt.dev`
4. Copy `deploy/mnrouter.service` → `/etc/systemd/system/`, `systemctl enable --now mnrouter`
5. **Cloudflare Tunnel**: tạo tunnel trong Cloudflare Zero Trust dashboard → public hostname `router.mncuchiinhuttt.dev` → service `http://localhost:8787` → copy token:
   ```
   sudo mkdir -p /etc/cloudflared && sudo chmod 700 /etc/cloudflared
   echo "<tunnel-token>" | sudo tee /etc/cloudflared/token > /dev/null
   # cài cloudflared (amd64 .deb từ github.com/cloudflare/cloudflared/releases) rồi:
   sudo cp deploy/cloudflared.service /etc/systemd/system/
   sudo systemctl enable --now cloudflared
   ```
6. Deploy mỗi lần cập nhật: `./deploy/deploy.sh user@wyse-host` (build web ở máy dev, rsync source + web-dist, migrate, restart — không build trên Wyse; tunnel không cần đụng tới)

Server production chạy `bun src/server/index.ts` trực tiếp (Bun chạy TS native — không cần bước build server).

## Bảo mật — ghi nhớ nhanh

- API key/session/magic-link **chỉ lưu SHA-256 hash** trong DB; key hiện plaintext đúng 1 lần lúc tạo/rotate.
- Cookie session `httpOnly + Secure + SameSite=Lax`.
- ClientId OAuth là client không chính thức của từng CLI (kiểu 9router/OMP) — rủi ro bị provider đổi; adapter là data-driven nên sửa nhanh (`src/server/gateway/registry.ts`).
- Antigravity/Kiro đang bị 9router đánh dấu RISK — ưu tiên thấp trong routing mặc định.
