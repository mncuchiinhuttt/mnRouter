/**
 * Router core: chọn connection theo priority/strategy, đảm bảo token fresh,
 * failover có cooldown/backoff per connection (tham khảo 9router), stream pipeline.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@db";
import { providerConnections, settings as settingsTable } from "@db/schema";
import type { CanonicalRequest, StreamEvent } from "./canonical.js";
import { UpstreamError, classifyUpstreamError } from "./canonical.js";
import { PROVIDERS, type ProviderId, DEFAULT_SETTINGS } from "./registry.js";
import { buildEgressRequest, type EgressConnectionInfo, type WireParser } from "./egress/index.js";
import { refreshProviderToken } from "./oauth.js";
import { isAntigravityExhaustedForModel } from "../services/antigravity-quota.service.js";
export type RoutingSettings = typeof DEFAULT_SETTINGS.routing;

// In-Flight Concurrency limits per connection by provider family
const MAX_CONCURRENCY_BY_PROVIDER: Record<string, number> = {
	antigravity: 3,
	kiro: 2,
	codex: 4,
	claude: 3,
	opencode: 5,
};

const inFlightMap = new Map<string, number>();
const inFlightLabels = new Map<string, string>();
let queuedWaitersCount = 0;

export function getInFlightStats() {
	const byConnection: Record<string, number> = {};
	let totalActive = 0;
	for (const [id, count] of inFlightMap.entries()) {
		if (count > 0) {
			const label = inFlightLabels.get(id) || id;
			byConnection[label] = count;
			totalActive += count;
		}
	}
	return { totalActive, queuedRequests: queuedWaitersCount, byConnection };
}

export function acquireConcurrency(connId: string, label?: string) {
	const current = inFlightMap.get(connId) || 0;
	inFlightMap.set(connId, current + 1);
	if (label) inFlightLabels.set(connId, label);
}

export function releaseConcurrency(connId: string) {
	const current = inFlightMap.get(connId) || 0;
	if (current <= 1) {
		inFlightMap.delete(connId);
	} else {
		inFlightMap.set(connId, current - 1);
	}
}

// Session Affinity Map: sessionId -> { connectionId, expiresAt }
const sessionAffinity = new Map<string, { connectionId: string; expiresAt: number }>();
const AFFINITY_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function recordSessionAffinity(sessionId: string, connectionId: string) {
	if (!sessionId) return;
	sessionAffinity.set(sessionId, { connectionId, expiresAt: Date.now() + AFFINITY_TTL_MS });
}

export function clearSessionAffinity(sessionId: string) {
	if (sessionId) sessionAffinity.delete(sessionId);
}

export async function getRoutingSettings(): Promise<RoutingSettings> {
	const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "routing"));
	return { ...DEFAULT_SETTINGS.routing, ...((row?.value as Partial<RoutingSettings>) ?? {}) };
}

type ConnRow = typeof providerConnections.$inferSelect;

function dataOf(conn: ConnRow): Record<string, any> {
	return (conn.data ?? {}) as Record<string, any>;
}

function cooldownRemaining(conn: ConnRow): number {
	const until = dataOf(conn).cooldownUntil;
	return typeof until === "number" ? Math.max(0, until - Date.now()) : 0;
}

async function orderConnections(
	provider: ProviderId,
	strategy: string,
	modelId?: string,
	sessionId?: string,
): Promise<ConnRow[]> {
	const rows = await db
		.select()
		.from(providerConnections)
		.where(and(eq(providerConnections.provider, provider), eq(providerConnections.isActive, true)));
	let usable = rows.filter((r) => cooldownRemaining(r) === 0);

	// Pre-route Quota Guard: Filter out accounts that have exhausted their quota or are under 5% for this model
	if (provider === "antigravity" && modelId) {
		const checked = await Promise.all(
			usable.map(async (conn) => {
				const check = await isAntigravityExhaustedForModel(conn.id, dataOf(conn), modelId);
				if (check.exhausted) {
					// Set cooldown until reset time so telegram/system stops spamming attempts
					const resetMs = check.resetTime ? new Date(check.resetTime).getTime() : 0;
					const now = Date.now();
					const cooldownMs = resetMs > now ? Math.min(resetMs - now, 3600 * 1000) : 300_000;
					void patchConnData(conn.id, { cooldownUntil: now + cooldownMs, lastError: check.reason }, "cooldown");
				}
				return { conn, exhausted: check.exhausted, reason: check.reason };
			}),
		);
		const nonExhausted = checked.filter((c) => !c.exhausted).map((c) => c.conn);
		if (nonExhausted.length > 0) {
			usable = nonExhausted;
		}
	}

	const maxLimit = MAX_CONCURRENCY_BY_PROVIDER[provider] || 3;

	// Sort candidate accounts:
	// 1. Least in-flight connections first (under saturation limit)
	// 2. Round-robin or Priority
	usable.sort((a, b) => {
		const inFlightA = inFlightMap.get(a.id) || 0;
		const inFlightB = inFlightMap.get(b.id) || 0;
		const saturatedA = inFlightA >= maxLimit ? 1 : 0;
		const saturatedB = inFlightB >= maxLimit ? 1 : 0;
		if (saturatedA !== saturatedB) return saturatedA - saturatedB;
		if (inFlightA !== inFlightB) return inFlightA - inFlightB;

		if (strategy === "round-robin") {
			return (dataOf(a).lastUsedAt ?? 0) - (dataOf(b).lastUsedAt ?? 0);
		}
		return a.priority - b.priority;
	});

	// Sticky Session Affinity: If incoming request belongs to an active session,
	// prioritize the previously pinned connection to reuse its prompt cache!
	if (sessionId) {
		const pinned = sessionAffinity.get(sessionId);
		if (pinned && pinned.expiresAt > Date.now()) {
			const idx = usable.findIndex((c) => c.id === pinned.connectionId);
			if (idx > 0) {
				const pinnedConn = usable[idx]!;
				const pinnedInFlight = inFlightMap.get(pinnedConn.id) || 0;
				// Only pin if not heavily saturated
				if (pinnedInFlight < maxLimit + 1) {
					usable.splice(idx, 1);
					usable.unshift(pinnedConn);
				}
			}
		}
	}

	return usable;
}

async function patchConnData(id: string, patch: Record<string, unknown>, status?: "active" | "cooldown" | "expired" | "error") {
	const [conn] = await db.select().from(providerConnections).where(eq(providerConnections.id, id));
	if (!conn) return;
	const existing = (conn.data as Record<string, unknown>) ?? {};
	const merged = { ...existing, ...patch };
	const updateSet: Record<string, unknown> = { data: merged, updatedAt: new Date() };
	if (status) updateSet.status = status;
	await db.update(providerConnections).set(updateSet).where(eq(providerConnections.id, id));
}
async function markSuccess(conn: ConnRow) {
	await patchConnData(
		conn.id,
		{
			backoffLevel: 0,
			cooldownUntil: null,
			lastError: null,
			lastErrorAt: null,
			lastUsedAt: Date.now(),
			consecutiveUseCount: (dataOf(conn).consecutiveUseCount ?? 0) + 1,
		},
		"active",
	);
}

async function markFailure(conn: ConnRow, cooldownMs: number, error: string) {
	const level = Math.min((dataOf(conn).backoffLevel ?? 0) + 1, 15);
	const backoff = cooldownMs > 0 ? cooldownMs : Math.min(2000 * 2 ** (level - 1), 300_000);
	await patchConnData(
		conn.id,
		{
			backoffLevel: level,
			cooldownUntil: Date.now() + backoff,
			lastError: error.slice(0, 500),
			lastErrorAt: Date.now(),
			consecutiveUseCount: 0,
		},
		"cooldown",
	);
	void import("../services/telegram.service.js").then(({ telegramService }) => {
		void telegramService.notifyCooldown(conn.provider, conn.label, error);
	});
}

async function markExpired(conn: ConnRow, error: string) {
	await patchConnData(conn.id, { lastError: error.slice(0, 500), lastErrorAt: Date.now() }, "expired");
	void import("../services/telegram.service.js").then(({ telegramService }) => {
		void telegramService.notifyCooldown(conn.provider, conn.label, `Token Expired: ${error}`);
	});
}

/** Refresh token nếu sắp hết hạn (hoặc chưa có access token). */
export async function ensureFreshToken(conn: ConnRow): Promise<string> {
	const d = dataOf(conn);
	const provider = conn.provider as ProviderId;
	if (provider === "opencode") {
		const token = d.accessToken || process.env.OPENCODE_ZEN_TOKEN || "REDACTED_OPEN_CODE_TOKEN";
		return token;
	}
	if (PROVIDERS[provider].noAuth) return "";
	const expiresAt = typeof d.expiresAt === "number" ? d.expiresAt : d.expiresAt ? new Date(d.expiresAt as string).getTime() : undefined;
	const lead = PROVIDERS[provider].oauth?.refreshLeadMs ?? 60_000;
	if (d.accessToken && (!expiresAt || Date.now() + lead < expiresAt)) return d.accessToken as string;
	if (!d.refreshToken || !PROVIDERS[provider].oauth) {
		if (d.accessToken) return d.accessToken as string;
		throw new UpstreamError("connection has neither access token nor refresh token", 401, "no_credentials", false);
	}
	try {
		const result = await refreshProviderToken(provider, d);
		const newExpiresAt = Date.now() + result.expiresIn * 1000;
		await patchConnData(
			conn.id,
			{
				accessToken: result.accessToken,
				refreshToken: result.refreshToken ?? d.refreshToken,
				expiresAt: newExpiresAt,
				lastRefreshAt: Date.now(),
			},
			"active",
		);
		return result.accessToken;
	} catch (err) {
		await markExpired(conn, `refresh failed: ${(err as Error).message}`);
		throw err;
	}
}

export interface UpstreamAttempt {
	conn: ConnRow;
	res: Response;
	parser: WireParser;
}

/** Try connections until one returns a successful upstream Response (before any client bytes). */
export async function openUpstreamWithFailover(
	provider: ProviderId,
	canonical: CanonicalRequest,
	opts?: { connIdHint?: string; sessionId?: string },
): Promise<{ attempt: UpstreamAttempt; connectionId: string; connectionLabel: string }> {
	const routing = await getRoutingSettings();
	const maxAttempts = opts?.connIdHint ? 1 : (routing.maxConnectionAttempts ?? 3);
	const sessionId = opts?.sessionId;

	let candidates = await orderConnections(provider, routing.strategy, canonical.upstreamModel || canonical.model, sessionId);
	if (opts?.connIdHint) candidates = candidates.filter((c) => c.id === opts.connIdHint);
	if (candidates.length === 0) {
		void import("../services/telegram.service.js").then(({ telegramService }) => {
			void telegramService.notifyAllConnectionsDown(provider, canonical.model);
		});
		throw new UpstreamError(`no active connection for provider "${provider}" (all cooling down or none configured)`, 503, "no_connection", false);
	}

	const errors: string[] = [];
	let tried = 0;
	for (const conn of candidates) {
		if (tried >= maxAttempts) break;
		tried++;
		try {
			const token = await ensureFreshToken(conn);
			const info: EgressConnectionInfo = {
				provider,
				accessToken: token,
				accountId: dataOf(conn).accountId,
				projectId: dataOf(conn).projectId,
				baseUrlOverride: conn.baseUrlOverride,
				profileArn: dataOf(conn).profileArn,
				authMethod: dataOf(conn).authMethod,
			};
			// baseUrl chain của connection (vd kiro: runtime → codewhisperer → q)
			const cfgBases = PROVIDERS[provider].baseUrls;
			const bases = conn.baseUrlOverride ? [conn.baseUrlOverride] : cfgBases.length > 1 ? cfgBases : [cfgBases[0] ?? ""];
			let lastStatus = 0;
			let lastBody = "";
			let succeeded: { res: Response; parser: WireParser } | null = null;
			for (const base of bases) {
				const built = buildEgressRequest(info, canonical, base);
				const res = await fetch(built.url, { method: "POST", headers: built.headers, body: built.body });
				if (res.ok) {
					succeeded = { res, parser: built.parser };
					break;
				}
				lastStatus = res.status;
				lastBody = await res.text().catch(() => "");
				const cls = classifyUpstreamError(lastStatus, lastBody.slice(0, 300));
				const canRetryBase = cls.retryable && (PROVIDERS[provider].retryStatuses.includes(lastStatus) || lastStatus >= 500 || lastStatus === 429);
				if (canRetryBase && base !== bases[bases.length - 1]) continue; // thử baseUrl kế tiếp
				break;
			}
			if (!succeeded) {
				const cls = classifyUpstreamError(lastStatus, lastBody.slice(0, 300));
				// If upstream returned 429 quota exhaustion, cool down for at least 30 minutes to prevent alert flooding
				const isQuotaExhausted = lastStatus === 429 && (
					lastBody.includes("RESOURCE_EXHAUSTED") ||
					lastBody.includes("check quota") ||
					lastBody.includes("quota")
				);
				const cooldown = isQuotaExhausted ? Math.max(cls.cooldownMs, 30 * 60 * 1000) : cls.cooldownMs;
				await markFailure(conn, cooldown, `HTTP ${lastStatus}: ${lastBody.slice(0, 200)}`);
				errors.push(`${conn.label}: HTTP ${lastStatus}`);
				const canRetry = cls.retryable && (PROVIDERS[provider].retryStatuses.includes(lastStatus) || lastStatus >= 500 || lastStatus === 429);
				if (tried < maxAttempts && (canRetry || candidates.length > tried)) continue;
				throw new UpstreamError(`upstream ${lastStatus}: ${lastBody.slice(0, 300)}`, lastStatus, "upstream_error", false);
			}
			acquireConcurrency(conn.id, conn.label);
			if (sessionId) recordSessionAffinity(sessionId, conn.id);
			return { attempt: { conn, res: succeeded.res, parser: succeeded.parser }, connectionId: conn.id, connectionLabel: conn.label };
		} catch (err) {
			if (sessionId) clearSessionAffinity(sessionId);
			if (err instanceof UpstreamError && !err.retryable && err.httpStatus !== 401 && err.httpStatus !== 403) throw err;
			errors.push(`${conn.label}: ${(err as Error).message}`);
			if (tried >= maxAttempts) break;
			continue;
		}
	}
	throw new UpstreamError(`all connections failed for ${provider}: ${errors.join(" | ")}`, 502, "all_connections_failed", false);
}

/** Translate an upstream SSE (hoặc NDJSON cho kiro) body into canonical StreamEvents. */
export async function* translateUpstreamStream(
	body: ReadableStream<Uint8Array>,
	parser: WireParser,
	provider: ProviderId,
): AsyncGenerator<StreamEvent> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let started = false;
	let finished = false;
	const isNdjson = provider === "kiro"; // kiro trả AWS eventstream nhị phân — feed raw chunks
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			const chunk = decoder.decode(value, { stream: true });
			if (isNdjson && parser.parseRaw) {
				for (const ev of parser.parseRaw(chunk)) {
					if (ev.type === "start" && !started) {
						started = true;
					}
					if (ev.type === "done" || ev.type === "error") finished = true;
					yield ev;
				}
				continue;
			}
			buffer += chunk;
			let idx: number;
			while ((idx = buffer.indexOf("\n")) >= 0) {
				const line = buffer.slice(0, idx).replace(/\r$/, "");
				buffer = buffer.slice(idx + 1);
				if (!line.startsWith("data:")) continue;
				const payload = line.slice(5).trim();
				if (!payload || payload === "[DONE]") continue;
				const events = parser.parse(payload);
				for (const ev of events) {
					if (ev.type === "start") {
						if (started) continue;
						started = true;
					}
					if (ev.type === "done" || ev.type === "error") finished = true;
					yield ev;
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
	if (!finished) {
		// provider didn't send a terminal usage event — synthesize
		const events = parser.finish();
		for (const ev of events) yield ev;
	}
	void provider;
}

export { markFailure, markSuccess };
