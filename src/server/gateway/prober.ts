/**
 * Automated Upstream Health Prober
 * Sends lightweight 1-token probe request to unverified/cooldown connections.
 * Recovers healthy connections and flags invalid tokens ahead of user requests.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@db";
import { providerConnections } from "@db/schema";
import { ensureFreshToken } from "./router.js";
import { PROVIDERS, type ProviderId } from "./registry.js";
import { buildEgressRequest, type EgressConnectionInfo } from "./egress/index.js";
import type { CanonicalRequest } from "./canonical.js";
import { telegramService } from "../services/telegram.service.js";

type ConnRow = typeof providerConnections.$inferSelect;

export interface ProbeResult {
	id: string;
	provider: string;
	label: string;
	ok: boolean;
	status: number;
	latencyMs: number;
	recovered: boolean;
	error?: string;
}

let probeTimer: ReturnType<typeof setInterval> | null = null;

export async function probeConnection(conn: ConnRow): Promise<ProbeResult> {
	const start = Date.now();
	const provider = conn.provider as ProviderId;
	const connData = (conn.data ?? {}) as Record<string, any>;

	try {
		const token = await ensureFreshToken(conn);
		const info: EgressConnectionInfo = {
			provider,
			accessToken: token,
			accountId: connData.accountId,
			projectId: connData.projectId,
			baseUrlOverride: conn.baseUrlOverride,
			profileArn: connData.profileArn,
			authMethod: connData.authMethod,
		};

		// Lightweight probe canonical request (1 token)
		const canonical: CanonicalRequest = {
			model: "probe",
			upstreamModel:
				provider === "antigravity"
					? "gemini-3.8-flash-low"
					: provider === "kiro"
					? "qwen3-coder-next"
					: provider === "claude"
					? "claude-haiku-4-5"
					: provider === "codex"
					? "gpt-5.4-nano"
					: "gemini-3.8-flash",
			messages: [{ role: "user", content: [{ type: "text", text: "p" }] }],
			maxTokens: 1,
			stream: false,
		};

		const cfgBases = PROVIDERS[provider].baseUrls;
		const base = conn.baseUrlOverride || cfgBases[0] || "";
		const built = buildEgressRequest(info, canonical, base);

		const res = await fetch(built.url, {
			method: "POST",
			headers: built.headers,
			body: built.body,
			signal: AbortSignal.timeout(8000),
		});

		const latencyMs = Date.now() - start;

		if (res.ok) {
			const wasCooldown = conn.status === "cooldown" || (typeof connData.cooldownUntil === "number" && connData.cooldownUntil > Date.now());
			// Recover connection back to healthy active state
			const patchData = {
				...connData,
				cooldownUntil: null,
				backoffLevel: 0,
				lastError: null,
				lastProbeAt: Date.now(),
				lastProbeLatencyMs: latencyMs,
			};
			await db.update(providerConnections).set({ status: "active", data: patchData, updatedAt: new Date() }).where(eq(providerConnections.id, conn.id));
			return { id: conn.id, provider, label: conn.label, ok: true, status: res.status, latencyMs, recovered: wasCooldown };
		}

		const errBody = await res.text().catch(() => "");
		const errorStr = `HTTP ${res.status}: ${errBody.slice(0, 150)}`;

		if (res.status === 401 || res.status === 403) {
			// Token revoked or unauthorized
			await db.update(providerConnections).set({ status: "expired", data: { ...connData, lastError: errorStr }, updatedAt: new Date() }).where(eq(providerConnections.id, conn.id));
			void telegramService.notifyTokenRefreshFailed(provider, conn.label, errorStr);
		}

		return { id: conn.id, provider, label: conn.label, ok: false, status: res.status, latencyMs, recovered: false, error: errorStr };
	} catch (err) {
		const latencyMs = Date.now() - start;
		return { id: conn.id, provider, label: conn.label, ok: false, status: 0, latencyMs, recovered: false, error: (err as Error).message };
	}
}

export async function probeAllConnections(onlyCooldownOrIdle = true): Promise<ProbeResult[]> {
	const all = await db.select().from(providerConnections).where(eq(providerConnections.isActive, true));
	const now = Date.now();
	const targets = onlyCooldownOrIdle
		? all.filter((c) => {
				const d = (c.data ?? {}) as Record<string, any>;
				const inCooldown = typeof d.cooldownUntil === "number" && d.cooldownUntil > now;
				const notProbedRecently = !d.lastProbeAt || now - Number(d.lastProbeAt) > 15 * 60 * 1000;
				return inCooldown || notProbedRecently;
		  })
		: all;

	const results: ProbeResult[] = [];
	for (const conn of targets) {
		const res = await probeConnection(conn);
		results.push(res);
		// Small stagger between probes
		await new Promise((r) => setTimeout(r, 250));
	}
	return results;
}

export function startProber() {
	if (probeTimer) return;
	// Probe every 15 minutes in background
	probeTimer = setInterval(() => {
		void probeAllConnections(true).catch((err) => console.error("[prober] routine error:", err.message));
	}, 15 * 60 * 1000);
	// Initial warm probe 45 seconds after boot
	setTimeout(() => void probeAllConnections(true).catch(() => {}), 45_000);
	console.log("[prober] started (background upstream probing every 15m)");
}

export function stopProber() {
	if (probeTimer) {
		clearInterval(probeTimer);
		probeTimer = null;
	}
}
