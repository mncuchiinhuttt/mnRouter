import { createServer, type Server } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { Database } from "bun:sqlite";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";

const SQLITE_FILE = "/tmp/mnrouter-e2e.db";
const APP_PORT = 8788;
const DATABASE_URL = SQLITE_FILE;
const BASE = `http://127.0.0.1:${APP_PORT}`;

let failures = 0;
function ok(cond: boolean, name: string, detail = "") {
	if (cond) console.log(`  ✅ ${name}`);
	else {
		failures++;
		console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
	}
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// ---------------- mock upstreams ----------------
const captured: Record<string, any> = {};

function sse(res: import("node:http").ServerResponse, chunks: string[]) {
	res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
	for (const c of chunks) res.write(c);
	res.end();
}

function mockClaude(): Promise<Server> {
	return new Promise((resolve) => {
		const s = createServer((req, res) => {
			let body = "";
			req.on("data", (d) => (body += d));
			req.on("end", () => {
				captured.claude = JSON.parse(body || "{}");
				const auth = req.headers.authorization ?? "";
				if (auth.includes("badtoken")) {
					res.writeHead(401, { "content-type": "application/json" });
					res.end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
					return;
				}
				sse(res, [
					`event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 25, cache_read_input_tokens: 5, cache_creation_input_tokens: 1 } } })}\n\n`,
					`event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })}\n\n`,
					`event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Xin chào" } })}\n\n`,
					`event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: " từ mock claude!" } })}\n\n`,
					`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`,
					`event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 9 } })}\n\n`,
					`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`,
				]);
			});
		});
		s.listen(9991, "127.0.0.1", () => resolve(s));
	});
}

function mockCodex(): Promise<Server> {
	return new Promise((resolve) => {
		const s = createServer((req, res) => {
			let body = "";
			req.on("data", (d) => (body += d));
			req.on("end", () => {
				captured.codex = JSON.parse(body || "{}");
				sse(res, [
					`event: response.created\ndata: ${JSON.stringify({ type: "response.created", response: { id: "resp_mock" } })}\n\n`,
					`event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: "mock codex " })}\n\n`,
					`event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: "tra loi" })}\n\n`,
					`event: response.completed\ndata: ${JSON.stringify({
						type: "response.completed",
						response: { usage: { input_tokens: 40, output_tokens: 6, input_tokens_details: { cached_tokens: 12 }, output_tokens_details: { reasoning_tokens: 2 } } },
					})}\n\n`,
				]);
			});
		});
		s.listen(9992, "127.0.0.1", () => resolve(s));
	});
}

function mockAntigravity(): Promise<Server> {
	return new Promise((resolve) => {
		const s = createServer((req, res) => {
			let body = "";
			req.on("data", (d) => (body += d));
			req.on("end", () => {
				captured.antigravity = JSON.parse(body || "{}");
				sse(res, [
					`data: ${JSON.stringify({ response: { candidates: [{ content: { role: "model", parts: [{ text: "AG part 1. " }] } }] } })}\n\n`,
					`data: ${JSON.stringify({ response: { candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "do_thing", args: { x: 5 } } }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 3, thoughtsTokenCount: 1 } } })}\n\n`,
				]);
			});
		});
		s.listen(9993, "127.0.0.1", () => resolve(s));
	});
}

function mockKiro(): Promise<Server> {
	return new Promise((resolve) => {
		const s = createServer((req, res) => {
			let body = "";
			req.on("data", (d) => (body += d));
			req.on("end", () => {
				captured.kiro = JSON.parse(body || "{}");
				sse(res, [
					`data: ${JSON.stringify({ event: { assistantResponseEvent: { content: "kiro reply" } } })}\n\n`,
					`data: ${JSON.stringify({ event: { toolUseEvent: { toolUseId: "ku1", name: "read_file", input: { path: "/tmp" } } } })}\n\n`,
					`data: ${JSON.stringify({ event: { modelUsage: { inputTokens: 33, outputTokens: 4 } } })}\n\n`,
				]);
			});
		});
		s.listen(9994, "127.0.0.1", () => resolve(s));
	});
}

/** Grok (xai) — OpenAI chat.completions wire trên /v1/chat/completions */
function mockGrok(): Promise<Server> {
	return new Promise((resolve) => {
		const s = createServer((req, res) => {
			let body = "";
			req.on("data", (d) => (body += d));
			req.on("end", () => {
				captured.grok = JSON.parse(body || "{}");
				captured.grokAuth = req.headers.authorization;
				sse(res, [
					`data: ${JSON.stringify({ choices: [{ delta: { role: "assistant" } }] })}\n\n`,
					`data: ${JSON.stringify({ choices: [{ delta: { content: "grok " } }] })}\n\n`,
					`data: ${JSON.stringify({ choices: [{ delta: { content: "noi" } }] })}\n\n`,
					`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 21, completion_tokens: 3, prompt_tokens_details: { cached_tokens: 4 } } })}\n\n`,
					"data: [DONE]\n\n",
				]);
			});
		});
		s.listen(9995, "127.0.0.1", () => resolve(s));
	});
}

/** OpenCode Free — /zen/v1/chat/completions noAuth (Bearer public) */
function mockOpencode(): Promise<Server> {
	return new Promise((resolve) => {
		const s = createServer((req, res) => {
			let body = "";
			req.on("data", (d) => (body += d));
			req.on("end", () => {
				captured.opencode = JSON.parse(body || "{}");
				captured.opencodeAuth = req.headers.authorization;
				captured.opencodeClient = req.headers["x-opencode-client"];
				sse(res, [
					`data: ${JSON.stringify({ choices: [{ delta: { role: "assistant" } }] })}\n\n`,
					`data: ${JSON.stringify({ choices: [{ delta: { content: "free model free" } }] })}\n\n`,
					`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 50, completion_tokens: 6 } })}\n\n`,
					"data: [DONE]\n\n",
				]);
			});
		});
		s.listen(9996, "127.0.0.1", () => resolve(s));
	});
}

function cleanDatabase(): void {
	for (const ext of ["", "-wal", "-shm"]) {
		const f = `${SQLITE_FILE}${ext}`;
		if (fs.existsSync(f)) fs.rmSync(f, { force: true });
	}
	console.log("  · clean sqlite database");
}
async function exec(cmd: string, label: string, ignoreFail = false): Promise<string> {
	const { execSync } = await import("node:child_process");
	try {
		const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
		console.log(`  · ${label}`);
		return out;
	} catch (err) {
		if (ignoreFail) {
			console.log(`  · ${label} (ignored)`);
			return "";
		}
		throw new Error(`${label} failed: ${(err as Error).message}`);
	}
}

// ---------------- helpers ----------------
async function startApp(): Promise<ChildProcess> {
	const child = spawn(process.execPath, ["src/server/index.ts"], {
		env: { ...process.env, DATABASE_URL, PORT: String(APP_PORT), APP_URL: BASE, SESSION_SECRET: "e2e-secret", NODE_ENV: "test", SMTP_PASS: "" },
		stdio: ["ignore", "pipe", "pipe"],
	});
	child.stdout!.on("data", (d) => process.stdout.write(`  [app] ${d}`));
	child.stderr!.on("data", (d) => process.stdout.write(`  [app:err] ${d}`));
	// wait for healthz
	for (let i = 0; i < 60; i++) {
		try {
			const r = await fetch(`${BASE}/healthz`);
			if (r.ok) return child;
		} catch {}
		await sleep(500);
	}
	throw new Error("app did not start");
}

interface DbClient {
	query(sqlStr: string): Promise<Record<string, any>[]>;
	end(): Promise<void>;
}
async function getDbClient(): Promise<DbClient> {
	const sqlite = new Database(SQLITE_FILE);
	return {
		query: (s: string) => {
			if (s.trim().toUpperCase().startsWith("SELECT")) {
				return Promise.resolve(sqlite.query(s).all() as any[]);
			}
			sqlite.run(s);
			return Promise.resolve([]);
		},
		end: () => {
			sqlite.close();
			return Promise.resolve();
		},
	};
}

async function readSse(res: Response): Promise<string[]> {
	const text = await res.text();
	return text
		.split("\n\n")
		.filter((b) => b.startsWith("data:"))
		.map((b) => b.slice(5).trim());
}

// ---------------- main ----------------
const mocks: Server[] = [];
let app: ChildProcess | null = null;
let invitedUserId = "";
let invitedKey = "";
let invitedCookie = "";

try {
	console.log("\n== 1. mock upstreams ==");
	mocks.push(await mockClaude(), await mockCodex(), await mockAntigravity(), await mockKiro(), await mockGrok(), await mockOpencode());
	console.log("  ✅ 6 mocks on :9991-9996");

	console.log("\n== 2. sqlite ==");
	cleanDatabase();

	console.log("\n== 3. app ==");
	app = await startApp();

	const db = await getDbClient();

	// seed: admin + session, user + key via API
	const now = Date.now();
	const tomorrow = now + 86400000;
	const weekLater = now + 7 * 86400000;
	const adminId = crypto.randomUUID();
	const aliceId = crypto.randomUUID();
	const adminToken = randomBytes(24).toString("hex");

	await db.query(`INSERT INTO users (id, email, role, max_api_keys, created_at) VALUES ('${adminId}', 'admin@test.local', 'admin', 10, ${now})`);
	await db.query(`INSERT INTO users (id, email, role, max_api_keys, created_at) VALUES ('${aliceId}', 'alice@test.local', 'user', 2, ${now})`);
	await db.query(`INSERT INTO sessions (id, user_id, token_hash, expires_at, last_used_at, created_at) VALUES ('${crypto.randomUUID()}', '${adminId}', '${sha(adminToken)}', ${tomorrow}, ${now}, ${now})`);
	const adminFetch = (path: string, init?: RequestInit) =>
		fetch(`${BASE}${path}`, { ...init, headers: { cookie: `mn_session=${adminToken}`, ...(init?.body ? { "content-type": "application/json" } : {}) } });

	const invitationRes = await adminFetch("/api/admin/invitations", {
		method: "POST",
		body: JSON.stringify({
			email: "invite-pending@test.local",
			packageName: "Starter",
			maxApiKeys: 1,
			monthlyTokenBudget: 1000,
			monthlyCreditBudget: 500,
			allModels: false,
			allowedModels: ["gpt-5.5"],
		}),
	});
	ok(invitationRes.status === 201, "admin sends a packaged invitation", String(invitationRes.status));
	const invitationRows = await db.query(`SELECT id, status, package_name, monthly_credit_budget FROM invitations WHERE email='invite-pending@test.local'`);
	ok(invitationRows[0]?.status === "pending" && invitationRows[0]?.package_name === "Starter", "invitation stores package budget");
	const invitationId = invitationRows[0]?.id as string;
	const revokeInvitation = await adminFetch(`/api/admin/invitations/${invitationId}`, { method: "DELETE" });
	ok(revokeInvitation.ok, "admin can revoke pending invitation");

	const acceptToken = "e2e-invitation-token";
	const invId = crypto.randomUUID();
	await db.query(`INSERT INTO invitations (id, email, token_hash, package_name, max_api_keys, monthly_credit_budget, all_models, allowed_models, status, expires_at, created_at) VALUES ('${invId}', 'invite-accepted@test.local', '${sha(acceptToken)}', 'Limited', 1, 500, 0, '["gpt-5.5"]', 'pending', ${weekLater}, ${now})`);
	const acceptedRes = await fetch(`${BASE}/api/auth/invitations/accept`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ token: acceptToken, displayName: "Invited User" }),
	});
	const acceptedJson = (await acceptedRes.json()) as { user?: { id: string; email: string; packageName: string } };
	invitedUserId = acceptedJson.user?.id ?? "";
	ok(acceptedRes.ok && acceptedJson.user?.email === "invite-accepted@test.local" && acceptedJson.user.packageName === "Limited", "user accepts invitation and account is created");
	const invitedUserRows = await db.query(`SELECT all_models, package_name, monthly_credit_budget FROM users WHERE id='${invitedUserId}'`);
	const invitedModelRows = await db.query(`SELECT model_id FROM user_models WHERE user_id='${invitedUserId}'`);
	ok(Boolean(invitedUserRows[0]?.all_models) === false && invitedUserRows[0]?.package_name === "Limited" && Number(invitedUserRows[0]?.monthly_credit_budget) === 500, "accepted account inherits package fields");
	ok(invitedModelRows.length === 1 && invitedModelRows[0]?.model_id === "gpt-5.5", "accepted account inherits model access");
	const invitedSession = "e2e-invited-session";
	await db.query(`INSERT INTO sessions (id, user_id, token_hash, expires_at, last_used_at, created_at) VALUES ('${crypto.randomUUID()}', '${invitedUserId}', '${sha(invitedSession)}', ${tomorrow}, ${now}, ${now})`);
	invitedCookie = `mn_session=${invitedSession}`;

	// create API key via admin API
	const keyRes = await adminFetch(`/api/admin/users/${aliceId}/keys`, { method: "POST", body: JSON.stringify({ name: "e2e" }) });
	const keyJson = (await keyRes.json()) as { key: string; id: string };
	ok(keyRes.status === 201 || keyRes.status === 200, "admin creates API key for alice", JSON.stringify(keyJson));
	const aliceKey = keyJson.key;

	// max_keys enforcement
	const key2 = await adminFetch(`/api/admin/users/${aliceId}/keys`, { method: "POST", body: JSON.stringify({ name: "second" }) });
	ok(key2.status === 200 || key2.status === 201, "second key created (max 2)");
	const key3 = await adminFetch(`/api/admin/users/${aliceId}/keys`, { method: "POST", body: JSON.stringify({ name: "third" }) });
	ok(key3.status === 409, "third key blocked by maxApiKeys");

	// connections: claude bad (failover) + claude good + codex + antigravity + kiro
	for (const conn of [
		{ provider: "claude", label: "claude-bad", priority: 1, tokens: { accessToken: "sk-ant-badtoken01" }, base: "http://127.0.0.1:9991" },
		{ provider: "claude", label: "claude-good", priority: 2, tokens: { accessToken: "sk-ant-goodtoken" }, base: "http://127.0.0.1:9991" },
		{ provider: "codex", label: "codex-1", priority: 1, tokens: { accessToken: "oat-good", accountId: "acc-777" }, base: "http://127.0.0.1:9992" },
		{ provider: "antigravity", label: "ag-1", priority: 1, tokens: { accessToken: "ya29.good", projectId: "proj-1" }, base: "http://127.0.0.1:9993" },
		{ provider: "kiro", label: "kiro-1", priority: 1, tokens: { accessToken: "kiro-tok" }, base: "http://127.0.0.1:9994" },
		{ provider: "grok", label: "grok-1", priority: 1, tokens: { accessToken: "xai-tok-123" }, base: "http://127.0.0.1:9995" },
	]) {
		const r = await adminFetch("/api/admin/connections", {
			method: "POST",
			body: JSON.stringify({ provider: conn.provider, label: conn.label, priority: conn.priority, baseUrlOverride: conn.base, tokens: conn.tokens }),
		});
		ok(r.ok, `import connection ${conn.label}`);
	}

	const modelRows = await (await adminFetch("/api/admin/models")).json() as { models: { id: string; priceCacheRead: number; priceCacheWrite: number }[] };
	const modelBefore = modelRows.models.find((model) => model.id === "gpt-5.5")!;
	const pricePatch = await adminFetch("/api/admin/models/gpt-5.5", {
		method: "PATCH",
		body: JSON.stringify({ priceCacheRead: 7, priceCacheWrite: 19 }),
	});
	const priceJson = await pricePatch.json() as { model?: { priceCacheRead: number; priceCacheWrite: number } };
	ok(pricePatch.ok && priceJson.model?.priceCacheRead === 7 && priceJson.model.priceCacheWrite === 19, "admin adjusts per-model cache credit prices");
	const modelRestore = await adminFetch("/api/admin/models/gpt-5.5", {
		method: "PATCH",
		body: JSON.stringify({ priceCacheRead: modelBefore.priceCacheRead, priceCacheWrite: modelBefore.priceCacheWrite }),
	});
	ok(modelRestore.ok, "model cache pricing can be restored");

	const gw = (path: string, body: unknown, key = aliceKey) =>
		fetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify(body) });

	const invitedKeyRes = await adminFetch(`/api/admin/users/${invitedUserId}/keys`, { method: "POST", body: JSON.stringify({ name: "invited" }) });
	const invitedKeyJson = (await invitedKeyRes.json()) as { key?: string };
	invitedKey = invitedKeyJson.key ?? "";
	ok(invitedKeyRes.ok && invitedKey.startsWith("mr_"), "admin grants key to invited account");
	const forbiddenModelRes = await gw("/v1/chat/completions", { model: "big-pickle", messages: [{ role: "user", content: "blocked" }] }, invitedKey);
	ok(forbiddenModelRes.status === 403, "model ACL blocks unassigned model", String(forbiddenModelRes.status));
	const allowedModelRes = await gw("/v1/chat/completions", { model: "gpt-5.5", messages: [{ role: "user", content: "allowed" }] }, invitedKey);
	ok(allowedModelRes.status === 200, "model ACL allows assigned model", String(allowedModelRes.status));

	console.log("\n== 4. OpenAI chat/completions (stream, failover bad→good claude) ==");
	const chatRes = await gw("/v1/chat/completions", {
		model: "claude-sonnet-5",
		stream: true,
		messages: [{ role: "user", content: "chao" }],
	});
	ok(chatRes.status === 200, "stream request 200 (failover qua connection tốt)", String(chatRes.status));
	const chatChunks = await readSse(chatRes);
	const chatDeltas = chatChunks.filter((c) => c !== "[DONE]").map((c) => JSON.parse(c));
	const text = chatDeltas.map((d) => d.choices?.[0]?.delta?.content ?? "").join("");
	ok(text === "Xin chào từ mock claude!", "SSE text deltas ghép đúng", JSON.stringify(text));
	const usageChunk = chatDeltas.find((d) => d.usage);
	ok(usageChunk?.usage?.prompt_tokens === 25 && usageChunk.usage.prompt_tokens_details.cached_tokens === 5, "usage chunks đúng (cache read)", JSON.stringify(usageChunk?.usage));
	ok(chatChunks.at(-1) === "[DONE]", "[DONE] kết thúc", JSON.stringify(chatChunks.at(-1)));
	ok(captured.claude.system === undefined, "claude wire: không system khi ingress không gửi");
	ok(chatRes.headers.get("content-type")!.includes("text/event-stream"), "content-type SSE");

	console.log("\n== 5. Anthropic /v1/messages (non-stream) ==");
	const msgRes = await gw("/v1/messages", { model: "claude-sonnet-5", max_tokens: 100, messages: [{ role: "user", content: "hi" }] });
	const msgJson = (await msgRes.json()) as any;
	ok(msgRes.status === 200, "messages 200");
	ok(msgJson.type === "message" && msgJson.content[0].text === "Xin chào từ mock claude!", "anthropic non-stream format đúng", JSON.stringify(msgJson.content));
	ok(msgJson.usage.input_tokens === 25 && msgJson.usage.output_tokens === 9, "anthropic usage đúng", JSON.stringify(msgJson.usage));

	console.log("\n== 6. OpenAI Responses /v1/responses (codex) ==");
	const respRes = await gw("/v1/responses", { model: "gpt-5.5", stream: true, input: "ping", instructions: "be terse" });
	ok(respRes.status === 200, "responses 200", String(respRes.status));
	const respRaw = await respRes.text();
	if (!respRaw.includes("output_text.delta")) console.log("  [debug] responses raw:", respRaw.slice(0, 600));
	const respChunks = respRaw
		.split("\n\n")
		.map((b) => b.split("\n").find((l) => l.startsWith("data:"))?.slice(5).trim())
		.filter((c): c is string => Boolean(c) && c !== "[DONE]")
		.map((c) => JSON.parse(c));
	const respText = respChunks.filter((d) => d.type === "response.output_text.delta").map((d) => d.delta).join("");
	ok(respText === "mock codex tra loi", "responses SSE text đúng", JSON.stringify(respText));
	const completed = respChunks.find((d) => d.type === "response.completed");
	ok(completed?.response?.usage?.input_tokens === 40 && completed.response.usage.input_tokens_details.cached_tokens === 12, "responses usage đúng", JSON.stringify(completed?.response?.usage));
	ok(captured.codex.instructions === "be terse" && captured.codex.store === false, "codex wire: instructions + store:false");
	ok(captured.codex.model === "gpt-5.5", "codex wire: upstream model");

	console.log("\n== 7. Antigravity + Kiro egress ==");
	const agRes = await gw("/v1/chat/completions", { model: "gemini-pro-agent", stream: false, messages: [{ role: "user", content: "go" }] });
	const agJson = (await agRes.json()) as any;
	ok(agJson.choices?.[0]?.message?.content === "AG part 1. ", "antigravity non-stream text", JSON.stringify(agJson.choices?.[0]?.message));
	ok(agJson.choices[0].message.tool_calls?.[0]?.function?.name === "do_thing", "antigravity tool call");
	ok(captured.antigravity.project === "proj-1" && captured.antigravity.requestType === "agent", "antigravity envelope: project + requestType");
	ok(Array.isArray(captured.antigravity.request?.contents), "antigravity envelope: contents");

	const kiroRes = await gw("/v1/chat/completions", { model: "claude-sonnet-4.5-kiro", stream: false, messages: [{ role: "user", content: "kiro?" }] });
	ok(kiroRes.status === 404, "kiro is temporarily disabled (404)");

	console.log("\n== 7b. Grok (temporarily disabled) ==");
	const grokRes = await gw("/v1/chat/completions", { model: "grok-4", stream: true, messages: [{ role: "user", content: "grok?" }] });
	ok(grokRes.status === 404, "grok is temporarily disabled (404)");
	console.log("\n== 7c. OpenCode Free (noAuth) ==");
	// app tự seed connection opencode-free lúc boot — trỏ nó về mock
	const conns0 = await (await adminFetch("/api/admin/connections")).json() as { connections: { id: string; provider: string; label: string }[] };
	const ocConn = conns0.connections.find((x) => x.provider === "opencode");
	ok(Boolean(ocConn), "opencode-free connection được seed sẵn");
	if (ocConn) {
		const pr = await adminFetch(`/api/admin/connections/${ocConn.id}`, { method: "PATCH", body: JSON.stringify({ baseUrlOverride: "http://127.0.0.1:9996" }) });
		ok(pr.ok, "redirect opencode connection → mock");
	}
	const ocRes = await gw("/v1/chat/completions", { model: "big-pickle", stream: false, messages: [{ role: "user", content: "free?" }] });
	const ocJson = (await ocRes.json()) as any;
	ok(ocRes.status === 200 && ocJson.choices?.[0]?.message?.content === "free model free", "opencode text", JSON.stringify(ocJson.choices?.[0]?.message));
	ok(captured.opencodeAuth === "Bearer public" && captured.opencodeClient === "desktop", "opencode wire: Bearer public + client header");
	ok(ocJson.usage?.prompt_tokens === 50, "opencode usage");

	console.log("\n== 8. models + errors + magic link + rotate ==");
	const modelsRes = await fetch(`${BASE}/v1/models`, { headers: { authorization: `Bearer ${aliceKey}` } });
	const modelsJson = (await modelsRes.json()) as any;
	ok(modelsJson.data.length >= 10, "GET /v1/models list", String(modelsJson.data?.length));
	const modelIds = new Set(modelsJson.data.map((model: { id: string }) => model.id));
	ok(modelIds.has("muse-spark-1.3-contributor-free"), "OpenCode Zen Muse Spark 1.3 Free is discoverable");
	ok(modelIds.has("gpt-6-astra") && modelIds.has("claude-sonnet-5"), "latest provider models are discoverable");
	const invitedModelsRes = await fetch(`${BASE}/v1/models`, { headers: { authorization: `Bearer ${invitedKey}` } });
	const invitedModelsJson = (await invitedModelsRes.json()) as { data: { id: string }[] };
	ok(invitedModelsJson.data.length === 1 && invitedModelsJson.data[0]?.id === "gpt-5.5", "GET /v1/models filters by account model permissions");

	const badModel = await gw("/v1/chat/completions", { model: "nope-model", messages: [{ role: "user", content: "x" }] });
	ok(badModel.status === 404, "model lạ → 404 model_not_found", String(badModel.status));

	const badKey = await gw("/v1/chat/completions", { model: "claude-sonnet-5", messages: [] }, "mr_wrongkey");
	ok(badKey.status === 401, "sai key → 401", String(badKey.status));

	const magicRes = await fetch(`${BASE}/api/auth/magic-link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "alice@test.local" }) });
	ok(magicRes.status === 200, "magic-link request OK (dev: log ra console)");
	const linkRows = await db.query(`SELECT token_hash FROM magic_links ORDER BY created_at DESC LIMIT 1`);
	ok(linkRows.length === 1, "magic link row tạo trong DB");

	// rotate alice's first key (portal APIs dùng session cookie, không phải API key)
	const aliceSession = randomBytes(24).toString("hex");
	await db.query(`INSERT INTO sessions (id, user_id, token_hash, expires_at, last_used_at, created_at) VALUES ('${crypto.randomUUID()}', '${aliceId}', '${sha(aliceSession)}', ${Date.now() + 86400000}, ${Date.now()}, ${Date.now()})`);
	const aliceFetch = (path: string, init?: RequestInit) =>
		fetch(`${BASE}${path}`, { ...init, headers: { cookie: `mn_session=${aliceSession}`, ...(init?.body ? { "content-type": "application/json" } : {}) } });
	const myKeysRes = await aliceFetch("/api/me/keys");
	const myKeys = (await myKeysRes.json()) as { keys: { id: string; prefix: string; active: boolean }[] };
	const activeKey = myKeys.keys.find((k) => k.active && k.prefix === aliceKey.slice(0, 11))!;
	const rotRes = await aliceFetch(`/api/me/keys/${activeKey.id}/rotate`, { method: "POST", body: "{}" });
	const rotJson = (await rotRes.json()) as { key: string };
	ok(rotRes.ok && rotJson.key.startsWith("mr_"), "user rotate key OK");
	const oldKeyRes = await gw("/v1/chat/completions", { model: "claude-sonnet-5", messages: [{ role: "user", content: "x" }] }, aliceKey);
	ok(oldKeyRes.status === 401, "key cũ chết sau rotate", String(oldKeyRes.status));
	const newKeyRes = await gw("/v1/chat/completions", { model: "claude-sonnet-5", messages: [{ role: "user", content: "x" }] }, rotJson.key);
	ok(newKeyRes.status === 200, "key mới hoạt động");

	// user self-creates API key + admin manages & revokes keys
	const selfCreateBlocked = await aliceFetch("/api/me/keys", { method: "POST", body: JSON.stringify({ name: "blocked" }) });
	ok(selfCreateBlocked.status === 409, "user cannot exceed maxApiKeys when self-creating");
	const aliceKeysRes = await adminFetch(`/api/admin/users/${aliceId}/keys`);
	const aliceKeysFromAdmin = (await aliceKeysRes.json()) as { keys: { id: string; prefix: string; active: boolean }[] };
	ok(aliceKeysFromAdmin.keys.length >= 2, "admin lists user keys via /api/admin/users/:id/keys");
	const keyToRevoke = aliceKeysFromAdmin.keys.find((k) => k.active && k.prefix !== rotJson.key.slice(0, 11))!;
	const adminRevokeRes = await adminFetch(`/api/admin/keys/${keyToRevoke.id}`, { method: "DELETE" });
	ok(adminRevokeRes.ok, "admin revokes user key via /api/admin/keys/:id");
	const selfCreateRes = await aliceFetch("/api/me/keys", { method: "POST", body: JSON.stringify({ name: "self-created" }) });
	const selfCreateJson = (await selfCreateRes.json()) as { key: string; id: string };
	ok(selfCreateRes.status === 201 && selfCreateJson.key.startsWith("mr_"), "user self-creates key after slot freed");

	console.log("\n== 9. usage tracking ==");
	await sleep(2000); // recordUsage là fire-and-forget — chờ inserts kịp ghi
	const usageRows = await db.query(`SELECT provider, model, status, prompt_tokens, completion_tokens, credits FROM usage_requests ORDER BY id DESC LIMIT 12`);
	ok(usageRows.length >= 8, `usage_requests ghi ${usageRows.length} rows: ${JSON.stringify(usageRows.map((r: any) => `${r.provider}/${r.status}`))}`);
	ok(usageRows.some((r: any) => r.provider === "claude" && r.status === "ok" && Number(r.prompt_tokens) === 25), "claude usage tokens đúng");
	ok(usageRows.some((r: any) => r.provider === "codex" && Number(r.prompt_tokens) === 40), "codex usage đúng");
	ok(!usageRows.some((r: any) => r.provider === "kiro"), "kiro is disabled (no usage)");

	console.log("\n== 9b. AI credits ==");
	ok(!usageRows.some((r: any) => r.provider === "grok"), "grok is disabled (no usage)");
	const ocRow = usageRows.find((r: any) => r.provider === "opencode");
	ok(Number(ocRow?.credits ?? 0) >= 0, "opencode credits computed");
	const claudeRow = usageRows.find((r: any) => r.provider === "claude" && Number(r.prompt_tokens) === 25);
	ok(Number(claudeRow?.credits ?? 0) > 0, `claude credits > 0 (${claudeRow?.credits})`);
	const dailyCreditsRows = await db.query(`SELECT SUM(CAST(credits AS NUMERIC)) AS total FROM usage_daily`);
	ok(Number(dailyCreditsRows[0]?.total ?? 0) > 0, "usage_daily aggregate credits > 0");
	const dailyRows = await db.query(`SELECT * FROM usage_daily`);
	ok(dailyRows.length >= 3, `usage_daily aggregate ${dailyRows.length} rows`);

	const invitedLogsRes = await fetch(`${BASE}/api/me/logs?limit=20`, { headers: { cookie: invitedCookie } });
	const invitedLogs = (await invitedLogsRes.json()) as { logs: { model: string; credits: string; promptTokens: number }[] };
	ok(invitedLogsRes.ok && invitedLogs.logs.some((log) => log.model === "gpt-5.5" && Number(log.promptTokens) === 40), "user can view own request logs");
	ok(invitedLogs.logs.some((log) => Number(log.credits) > 0), "user request log includes AI credit cost");
	const forbiddenRows = await db.query(`SELECT status FROM usage_requests WHERE user_id='${invitedUserId}' AND status='forbidden'`);
	ok(forbiddenRows.length >= 1, "model ACL denial is recorded in usage logs");

	// failover evidence: bad connection should be cooldown
	const connsRes = await adminFetch("/api/admin/connections");
	const connsJson = (await connsRes.json()) as { connections: { label: string; status: string }[] };
	const bad = connsJson.connections.find((c) => c.label === "claude-bad");
	ok(bad?.status === "cooldown", "connection lỗi bị cooldown (failover)", JSON.stringify(bad));

	console.log("\n== 10. budget + rate limit ==");
	await db.query(`UPDATE users SET monthly_credit_budget = 0 WHERE id = '${aliceId}'`);
	const creditBudgetRes = await gw("/v1/chat/completions", { model: "claude-sonnet-5", messages: [{ role: "user", content: "credit blocked" }] }, rotJson.key);
	ok(creditBudgetRes.status === 429, "credit budget zero blocks usage", String(creditBudgetRes.status));
	await db.query(`UPDATE users SET monthly_credit_budget = NULL WHERE id = '${aliceId}'`);

	await adminFetch("/api/admin/settings", { method: "PUT", body: JSON.stringify({ key: "rateLimit", value: { requestsPerMinute: 1 } }) });
	const r1 = await gw("/v1/chat/completions", { model: "claude-sonnet-5", messages: [{ role: "user", content: "x" }] }, rotJson.key);
	const r2 = await gw("/v1/chat/completions", { model: "claude-sonnet-5", messages: [{ role: "user", content: "x" }] }, rotJson.key);
	ok(r1.status === 200 && r2.status === 429, `rate limit 1 rpm chặn request thứ 2 (${r1.status}/${r2.status})`);

	console.log("\n== 11. audit + logs API ==");
	const logsRes = await adminFetch("/api/admin/logs?limit=5");
	ok(logsRes.ok, "admin logs API");
	const auditRes = await adminFetch("/api/admin/audit");
	const auditJson = (await auditRes.json()) as { audit: { action: string }[] };
	ok(auditJson.audit.some((a) => a.action === "key.create"), "audit log ghi nhận key.create");

	await db.end();
} catch (err) {
	failures++;
	console.error("\n💥 E2E crashed:", err);
} finally {
	for (const m of mocks) m.close();
	app?.kill("SIGTERM");
	cleanDatabase();
}

console.log(failures === 0 ? "\n🎉 E2E ALL PASS" : `\n💀 ${failures} E2E FAILURES`);
process.exit(failures === 0 ? 0 : 1);
