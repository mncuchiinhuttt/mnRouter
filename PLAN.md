# MNRouter — Plan kiến trúc & triển khai

> Internal AI Gateway/Router chạy trên Dell Wyse 3040 (Debian 12 Minimal, 16GB eMMC, CPU yếu).
> Chuẩn hoá mọi harness (Claude Code, Codex CLI, Gemini/Antigravity, Kiro, OpenCode, ...) vào 1 cổng API,
> phía sau là các tài khoản OAuth thật (Claude, ChatGPT/Codex, Google/Antigravity, AWS Kiro).
> Chỉ dùng nội bộ: không signup, admin khởi tạo user, login bằng magic-link email.

Nguồn research:
- **OMP (oh-my-pi)** `@oh-my-pi/pi-ai` v18 (local `~/node_modules/@oh-my-pi/pi-ai/src`): mô hình canonical message/event stream, usage accounting, OAuth per-provider, retry.
- **9router** v0.5.55 (local `/opt/homebrew/lib/node_modules/9router`, data `~/.9router`): registry ~75 providers với endpoint/OAuth clientId thật, chiến lược rotation/failover, bảng cooldown, background token refresh, data model SQLite.
- **TestAppleMail** (local `~/SvelteProjects/TestAppleMail`): gửi mail = **nodemailer + iCloud SMTP** `smtp.mail.me.com:587` (STARTTLS, rejectUnauthorized), From `system@mncuchiinhuttt.dev` (iCloud custom domain, app-specific password).

---

## 1. Nguyên tắc thiết kế

1. **Nhẹ**: 1 process Node duy nhất (serve cả API + web tĩnh), KHÔNG Docker, KHÔNG Redis (single instance → rate-limit in-memory là đủ), DB hosted trên Neon (máy chỉ chạy app).
2. **Chuẩn hoá ở giữa**: mọi ingress (OpenAI Chat, OpenAI Responses, Anthropic Messages) → **Canonical format** → adapter provider. Thêm harness mới = thêm 1 bộ converter, không đụng adapter provider.
3. **Adapter provider là data-driven**: endpoint, clientId, scopes, refresh lead, retry/cooldown nằm trong registry config → Antigravity/Kiro đổi endpoint chỉ cần sửa config, không sửa logic.
4. **Ghi log hết**: 1 row / request (token in/out/cache, latency, status, user, key, connection) + aggregate theo ngày + audit log hành động admin.
5. **Bảo mật tối thiểu đủ dùng**: magic-link token & session & API key chỉ lưu **SHA-256 hash**; key hiện thị dạng `mr_…prefix`; secrets qua env; cookie httpOnly+Secure; CORS đóng.

## 2. Stack

| Layer | Chọn | Lý do |
|---|---|---|
| Runtime | **Bun** (TS native, không build server) | 1 binary, khởi động nhanh, RSS thấp, `bun test` sẵn | HTTP server | **Hono** trên `Bun.serve` | nhanh, API nhỏ gọn, hỗ trợ SSE/stream, static qua `hono/bun` |
| ORM | **Drizzle ORM + drizzle-kit** → **Neon Postgres** | yêu cầu của bạn; Neon free tier, pooled connection |
| Validate | zod | schema dùng chung client/server |
| Mail | nodemailer + iCloud SMTP | đúng cách TestAppleMail đang làm |
| Frontend | **Vite + React + Tailwind v4 + shadcn/ui** + TanStack Query + Recharts | yêu cầu của bạn |
| Icons/font | lucide (shadcn ecosystem) / **Space Grotesk** (display) + **IBM Plex Mono** (data/label), self-host qua @fontsource | tech, khác font của Nous |
| Test | vitest (unit) + e2e tự viết (mock upstream) | không cần infra ngoài |
| Deploy | systemd + **Cloudflare Tunnel** (IP động — không mở port, TLS ở Cloudflare), **Bun** qua /usr/local/bin | không Docker |

Repo layout (1 package duy nhất cho dễ maintain):

```
mnRouter/
├─ PLAN.md, README.md, .env.example
├─ package.json / tsconfig.json / vite.config.ts / drizzle.config.ts
├─ deploy/            # mnrouter.service, cloudflared.service, deploy.sh, setup-wyse.md
├─ src/
│  ├─ server/
│  │  ├─ index.ts            # bootstrap: hono app + static + refresher cron
│  │  ├─ env.ts              # zod-parse env
│  │  ├─ db/                 # schema.ts, index.ts (drizzle + postgres.js)
│  │  ├─ mail/               # nodemailer service + template magic link
│  │  ├─ auth/               # magic-link, session, api-key, guards
│  │  ├─ gateway/
│  │  │  ├─ canonical.ts     # kiểu dữ liệu chuẩn hoá (tham khảo pi-ai)
│  │  │  ├─ ingress/         # openai-chat.ts, openai-responses.ts, anthropic.ts  → canonical
│  │  │  ├─ egress/          # claude.ts, codex.ts, antigravity.ts, kiro.ts    → canonical↔wire
│  │  │  ├─ registry.ts      # provider registry (endpoint/oauth/retry) data-driven
│  │  │  ├─ router.ts        # chọn connection, failover, cooldown/backoff
│  │  │  ├─ refresher.ts     # background refresh token
│  │  │  └─ usage.ts         # trích usage từ response/stream
│  │  ├─ limits/             # rate-limit in-memory + monthly budget check
│  │  └─ routes/             # gateway.ts (/v1/*), admin.ts, user.ts, auth.ts
│  └─ shared/                # types + zod schema dùng chung web/server
├─ web/                      # React app (Vite root), dist build → server phục vụ tĩnh
│  └─ src/{pages,components/ui (shadcn),lib}
└─ test/                     # vitest unit + e2e (mock upstream)
```

## 3. Data model (Drizzle / Postgres)

```
users             id uuid pk, email citext unique, role enum(admin,user), displayName,
                  status enum(active,disabled), maxApiKeys int default 1,
                  monthlyTokenBudget bigint null (=unlimited), createdAt, disabledAt
magic_links       id, email, tokenHash sha256, expiresAt (15'), usedAt, ip, ua, createdAt
sessions          id, userId→users, tokenHash, expiresAt (15 ngày), lastUsedAt, ip, ua
api_keys          id, userId→users, name, prefix (8 ký tự đầu để hiển thị), keyHash sha256 unique,
                  createdAt, createdBy (admin id), lastUsedAt, revokedAt
provider_connections  id, provider enum(claude,codex,antigravity,kiro), label, priority int,
                  isActive bool, status enum(active,cooldown,expired,error),
                  data jsonb { accessToken, refreshToken, expiresAt, accountId, projectId,
                               backoffLevel, lastErrorAt, lastError, lastUsedAt, consecutiveUseCount },
                  baseUrlOverride text null (để test/mock), createdAt, updatedAt
models            id text pk (tên public, vd "claude-sonnet-4-5"), provider, upstreamModel,
                  displayName, enabled, priority, contextWindow, maxOutput
settings          key pk, value jsonb   (routing strategies, rate limit default, pricing…)
usage_requests    id bigserial, ts, userId, apiKeyId, provider, connectionId, model, endpoint,
                  status enum(ok,error,budget_exceeded,rate_limited), httpStatus,
                  promptTokens, completionTokens, cacheReadTokens, cacheWriteTokens,
                  reasoningTokens, latencyMs, ttftMs, errorCode, meta jsonb
usage_daily       (date, userId, provider, model) pk, requests, errors,
                  promptTokens, completionTokens, cacheRead, cacheWrite   ← pre-aggregate cho chart
audit_logs        id, ts, actorUserId, action, target, data jsonb
```

Quy ước API key: `mr_<43 ký tự base62>` (32 byte entropy). DB chỉ lưu `sha256(key)`; prefix 8 ký tự để tra cứu nhanh + hiển thị.

## 4. Chuẩn hoá API (mục đích chính của dự án)

### 4.1 Ingress — server NHẬN 3 chuẩn, ai dùng harness gì cũng vào được

| Endpoint | Chuẩn | Harness tiêu biểu |
|---|---|---|
| `POST /v1/chat/completions` | OpenAI Chat Completions (stream + non-stream) | hầu hết tool/lib |
| `POST /v1/responses` | OpenAI Responses | Codex CLI |
| `POST /v1/messages` | Anthropic Messages (+`/v1/messages/count_tokens`) | Claude Code |
| `GET  /v1/models` | OpenAI list models | discovery |

Auth: `Authorization: Bearer mr_…`. Model truyền dạng `claude-sonnet-4-5` (alias public) hoặc `provider/model`; registry map sang upstream model thật.

### 4.2 Canonical format (tham khảo `pi-ai` types.ts / stream.ts)

```ts
type Role = "user" | "assistant" | "toolResult";
interface ToolCall  { id, name, arguments(json, stream bằng partial-json), thoughtSignature? }
type ContentBlock   = { type:"text",text } | { type:"thinking",thinking,signature? } | { type:"image",mime,data }
                    | { type:"toolCall",...ToolCall } | { type:"toolResult",toolUseId,content,isError? }
interface CanonicalMessage { role, content: ContentBlock[] }
interface CanonicalRequest  { model, system?, messages[], tools?[{name,description,schema}], toolChoice?, stream, maxTokens?, temperature?, reasoning? }
// Stream event chuẩn (map 1-1 sang SSE của cả 3 ingress):
type StreamEvent = {type:"start"} | {type:"text_delta",delta} | {type:"thinking_delta",delta}
  | {type:"toolcall_start"|"toolcall_delta"|"toolcall_end", id?|delta|toolCall}
  | {type:"done", stopReason:"stop"|"length"|"toolUse", usage} | {type:"error", error}
```

### 4.3 Egress — 4 provider adapter (endpoint thật lấy từ 9router/OMP)

| Provider | OAuth | Upstream | Wire format |
|---|---|---|---|
| **claude** | PKCE `9d1c250a-e61b-44d9-88ed-5944d1962f5e`, authorize `claude.ai/oauth/authorize`, token `api.anthropic.com/v1/oauth/token`, refresh lead 24 phút | `https://api.anthropic.com/v1/messages` (+ header `anthropic-beta: oauth-2025-04-20`) | Anthropic Messages |
| **codex** | PKCE `app_EMoamEEZ73f0CkXaXp7hrann` @ `auth.openai.com/oauth/{authorize,token}`, scope `openid profile email offline_access`, originator `codex_cli_rs` | `https://chatgpt.com/backend-api/codex/responses` (+header `chatgpt-account-id`) | OpenAI Responses (`store:false`) |
| **antigravity** (và gemini-cli) | Google OAuth, scope `cloud-platform userinfo.email userinfo.profile ...`, token `oauth2.googleapis.com/token` | `https://cloudcode-pa.googleapis.com/v1internal` (`:loadCodeAssist`, `:generateContent`) | Gemini/cloudcode envelope |
| **kiro** | AWS SSO OIDC device flow (`oidc.us-east-1.amazonaws.com/client/register` → `device_authorization` → `token`) hoặc refresh social `prod.us-east-1.auth.desktop.kiro.dev/refreshToken` | failover chain: `runtime.us-east-1.kiro.dev/generateAssistantResponse` → `codewhisperer.us-east-1.amazonaws.com/...` → `q.us-east-1.amazonaws.com/...` | Kiro JSON (conversationState…) |

Mỗi adapter implement cùng interface: `translateRequest(canonical→wire)`, `parseResponse/parseStreamEvent(wire→StreamEvent)`, `refreshToken(connection)`, `extractUsage(wire)`.
**baseUrlOverride** trên connection cho phép e2e test trỏ về mock server cục bộ.

## 5. Routing, failover, refresh (mượn 9router)

- **Chọn connection trong provider**: `fill-first` (theo priority, dính đến khi lỗi) hoặc `round-robin` LRU (sticky N request) — cấu hình trong `settings` per provider.
- **Cooldown/backoff per connection** lưu ngay trong `provider_connections.data`: 401/403 → cooldown 120s; 429/5xx/timeout → backoff luỹ thừa 2s→300s (max 15 level); khi fail → thử connection kế tiếp (tối đa 3 connection/request, chỉ auto-retry với lỗi upstream, KHÔNG retry khi đã stream ra client).
- **Background refresher**: mỗi 60s quét connection sắp hết hạn (lead per provider: claude 24', google/kiro ~30'), refresh trước khi cần; refresh-on-demand nếu gặp token hết hạn.
- **Kiro**: thử tuần tự 3 URL upstream trong chain.

## 6. Auth & phân quyền (đúng yêu cầu)

1. **Không signup.** User chỉ được admin tạo (email + max keys + budget). DB rỗng lần đầu → script `bootstrap-admin <email>` tạo admin.
2. **Login = magic link**: nhập email → tạo `magic_links` (token 32B, hash lưu DB, hết hạn 15', single-use) → nodemailer gửi từ `system@mncuchiinhuttt.dev` → click link `APP_URL/auth/verify?token=…` → tạo session (cookie httpOnly, Secure, SameSite=Lax, **15 ngày**). Email không tồn tại → vẫn trả OK (tránh dò email), không gửi gì.
3. **API key**: user KHÔNG tự tạo. Admin bấm "Create key" cho user (tôn trọng `maxApiKeys`); user chỉ có nút **Rotate** (tạo key mới + thu cũ, hiện key plaintext đúng 1 lần) và **Revoke**. Key gắn user, mọi request log về user.
4. **Session admin/user**: cùng cơ chế, UI render theo `role`.

## 7. Usage, budget, rate limit

- Mỗi request (kể cả lỗi) → 1 row `usage_requests` + upsert `usage_daily` (async, sau khi stream kết thúc, không chặn pipeline).
- **Budget tháng per user** (admin set, null = unlimited): tổng (prompt+completion) tháng hiện tại vượt budget → chặn 429 `budget_exceeded` trước khi gọi upstream.
- **Rate limit nhẹ per key**: token bucket in-memory, mặc định 60 req/phút (đặt trong settings) → 429 `rate_limited` + header `Retry-After`.
- Dashboard user: thẻ SPEND-token / INPUT / OUTPUT / CACHE / REQUESTS + chart 30D (Recharts, by model / by day) — giống layout portal.nousresearch.com.

## 8. UI — phong cách Nous Portal, font tech hơn

- **Layout**: sidebar tối màu navy đậm (#0B0B26) chiếm ~19%, có texture halftone/pixel + logo mark + nav chữ mono small-caps với đường kẻ chân lý; content nền sáng (#F4F4F2), heading display lớn, breadcrumb `// SECTION` trên đầu.
- **Màu**: navy `#0B0B26` / electric blue `#2727F5` (accent duy nhất) / nền sáng off-white / chữ near-black. Không gradient tím AI.
- **Font**: Space Grotesk (heading/body) + IBM Plex Mono (label, số liệu, nav). Khác với Nous (họ dùng serif-condensed) → "tech hơn".
- **Trang user**: Overview (hero "Everything to power your agents" + thẻ LOW BALANCE-style budget + stats strip), Usage (chart + filter by model/bar), API Keys (bảng key đã mask + Rotate/Revoke).
- **Trang admin** (thêm): Users (tạo user, set maxKeys/budget, disable, xem tổng token từng user), Keys (tạo key cho user), Connections (thêm tài khoản OAuth từng provider — mở flow thiết bị/PKCE, xem health/cooldown, priority, strategy, test kết nối), Models (bật/tắt, map alias), Request Logs (explorer có filter), Audit, Settings (route strategy, rate limit).
- shadcn/ui: button, card, dialog, table, tabs, badge, input, select, toast, dropdown-menu — tuỳ biến token (radius nhỏ 6px, border 1px, mono label) — **không dùng default state**.

## 9. Mail (magic link)

Nodemailer transport: `host smtp.mail.me.com`, `port 587`, `secure:false` (STARTTLS), `auth {user, pass}` = app-password iCloud, `tls.rejectUnauthorized:true`. From: `"MNRouter" <system@mncuchiinhuttt.dev>`. Template HTML tối giản (inline style, như TestAppleMail) chứa nút/link verify + OTP text dự phòng. Env: `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.

## 10. Cấu hình (.env)

```
PORT=8787
APP_URL=https://router.mncuchiinhuttt.dev
DATABASE_URL=postgres://…neon…/mnrouter?sslmode=require
SESSION_SECRET=<random 32B>
SMTP_USER=<icloud account>, SMTP_PASS=<app-specific password>, MAIL_FROM=system@mncuchiinhuttt.dev
ADMIN_EMAIL=<email admin đầu tiên>     # bootstrap admin nếu DB rỗng
```

## 11. Deploy trên Wyse 3040 (không Docker)

- **Bun runtime**: server chạy `bun src/server/index.ts` trực tiếp (TS native). Build **web** ở máy dev (`bun run build` → `web-dist/`), `deploy/deploy.sh` rsync source + web-dist + `bun install --production` + `bun run scripts/migrate.ts` + restart systemd. Máy chỉ chạy 1 process bun (~60-100MB RAM).
- systemd unit `mnrouter.service` (EnvironmentFile `/etc/mnrouter.env`, Restart=always, MemoryMax=512M).
- **Exposure qua Cloudflare Tunnel** (`deploy/cloudflared.service`): tunnel outbound từ Wyse → không cần mở port/DNS trỏ IP (IP chung cư là IP động); public hostname `router.mncuchiinhuttt.dev` → `http://localhost:8787`; TLS terminate ở Cloudflare, app chỉ nghe HTTP nội bộ.
- Backup: Neon giữ data; bản dump định kỳ bằng `pg_dump` cron (optional).

## 12. Kiểm thử (tự test toàn bộ)

1. **Unit (vitest)**: converter OpenAI↔canonical, Anthropic↔canonical, Responses↔canonical, claude/codex/antigravity/kiro wire→StreamEvent (fixture mẫu), extractUsage từng provider, key hash/verify, budget & rate limit, magic-link lifecycle.
2. **E2E (node test runner)**: dựng 4 **mock upstream server** (claude/codex/antigravity/kiro) → khởi app thật với `DATABASE_URL` trỏ DB test trên Neon (branch tạm) → connection `baseUrlOverride` trỏ mock → gọi đủ 3 ingress (stream + non-stream) → assert SSE đúng định dạng từng chuẩn + usage_requests/usage_daily ghi đúng + budget chặn đúng + rotate key hoạt động.
3. **Smoke thật (tuỳ chọn, có token)**: `scripts/import-9router.ts` đọc `~/.9router/db/data.sqlite` (bảng `providerConnections`, token nằm plain JSON) import connection thật → test 1 request `claude-sonnet…` qua claude + 1 qua codex.
4. **UI**: build pass + chạy dev, tự soi các trang chính (login, overview, keys, connections, logs).

## 13. Thứ tự triển khai (milestone)

1. Scaffold + Drizzle schema + migrate + bootstrap-admin
2. Auth magic-link + session + mail
3. API keys (admin tạo / user rotate) + guards
4. Canonical + ingress OpenAI chat (stream/non-stream) + egress claude + router core (failover/cooldown) + usage log → **chạy được claude qua /v1/chat/completions**
5. Ingress anthropic + responses; egress codex, antigravity, kiro
6. Background refresher + rate limit + budget
7. UI portal (user + admin) + audit
8. Test suite + deploy script + docs → repo private `mncuchiinhuttt/mnRouter`

## 14. Rủi ro & ghi chú

- clientId của Claude/Codex/Gemini-cli/Kiro là **client không chính thức** (mượn của CLI tương ứng) → có thể bị đổi/thu hồi bất lúc nào; bù lại adapter là config-driven nên sửa nhanh. Chỉ dùng nội bộ.
- Antigravity/Kiro 9router đánh dấu RISK/deprecated → đặt cuối priority mặc định, có toggle bật/tắt per connection.
- Neon cold-start (~200-500ms request đầu) — chấp nhận được cho nội bộ; dùng connection string có `-pooler`.
- `usage_requests` có thể lớn → retention: xoá row chi tiết > 90 ngày (cron), giữ `usage_daily` vĩnh viễn.
