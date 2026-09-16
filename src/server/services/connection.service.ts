import { connectionRepo } from "../repositories/model.repository.js";
import { auditRepo } from "../repositories/usage.repository.js";
import { ensureFreshToken, markFailure, markSuccess } from "../gateway/router.js";
import { authorizeUrl, exchangeCode, pkcePair, kiroDeviceStart, kiroDevicePoll } from "../gateway/oauth.js";
import type { ProviderId } from "../gateway/registry.js";
import type { ProviderConnection } from "@db/schema";

const pendingOauth = new Map<string, { provider: ProviderId; verifier: string; expires: number }>();

export class ConnectionService {
	async listConnections() {
		const rows = await connectionRepo.listAll();
		const now = Date.now();
		return rows.map((r) => {
			const d = (r.data as Record<string, unknown>) ?? {};
			const cooldownUntil = Number(d.cooldownUntil ?? 0);
			const cooldownRemainingMs = Math.max(0, cooldownUntil - now);
			const effectiveStatus = r.status === "active" && cooldownRemainingMs > 0 ? "cooldown" : r.status;
			return {
				id: r.id,
				provider: r.provider,
				label: r.label,
				priority: r.priority,
				isActive: r.isActive,
				status: effectiveStatus,
				expiresAt: d.expiresAt ? Number(d.expiresAt) : null,
				lastError: (d.lastError as string) ?? null,
				lastUsedAt: d.lastUsedAt ? Number(d.lastUsedAt) : null,
				backoffLevel: Number(d.backoffLevel ?? 0),
				cooldownRemainingMs,
				email: (d.email as string) ?? null,
			};
		});
	}

	async importConnection(data: {
		provider: ProviderId;
		label?: string;
		priority?: number;
		baseUrlOverride?: string | null;
		tokens: Record<string, unknown>;
	}, actorId?: string): Promise<ProviderConnection> {
		const created = await connectionRepo.create({
			id: crypto.randomUUID(),
			provider: data.provider,
			label: data.label || data.provider,
			priority: data.priority ?? 100,
			authType: "oauth",
			isActive: true,
			status: "active",
			data: data.tokens,
			baseUrlOverride: data.baseUrlOverride || null,
		});

		if (actorId) {
			await auditRepo.record(actorId, "connection.import", created.id, { provider: data.provider, label: created.label });
		}
		return created;
	}

	async updateConnection(id: string, patch: Record<string, unknown>, actorId?: string): Promise<ProviderConnection | null> {
		const existing = await connectionRepo.findById(id);
		if (!existing) return null;

		const updateData: Partial<ProviderConnection> = {};
		if (typeof patch.label === "string") updateData.label = patch.label;
		if (typeof patch.priority === "number") updateData.priority = patch.priority;
		if (typeof patch.isActive === "boolean") updateData.isActive = patch.isActive;
		if (typeof patch.status === "string") updateData.status = patch.status as any;
		if (patch.baseUrlOverride !== undefined) updateData.baseUrlOverride = (patch.baseUrlOverride as string) || null;

		if (patch.resetHealth) {
			const d = (existing.data as Record<string, unknown>) ?? {};
			delete d.cooldownUntil;
			delete d.backoffLevel;
			delete d.lastError;
			delete d.lastErrorAt;
			updateData.data = d;
			updateData.status = "active";
		}

		const updated = await connectionRepo.update(id, updateData);
		if (updated && actorId) {
			await auditRepo.record(actorId, "connection.update", id, patch);
		}
		return updated;
	}

	async deleteConnection(id: string, actorId?: string): Promise<boolean> {
		const success = await connectionRepo.delete(id);
		if (success && actorId) {
			await auditRepo.record(actorId, "connection.delete", id);
		}
		return success;
	}

	async testConnection(id: string): Promise<{ ok: boolean; error?: string }> {
		const conn = await connectionRepo.findById(id);
		if (!conn) return { ok: false, error: "not_found" };
		try {
			await ensureFreshToken(conn as any);
			await markSuccess(conn as any);
			return { ok: true };
		} catch (err) {
			await markFailure(conn as any, 401, (err as Error).message);
			return { ok: false, error: (err as Error).message };
		}
	}

	async startOauth(provider: ProviderId) {
		if (provider === "kiro") {
			const device = await kiroDeviceStart();
			const state = crypto.randomUUID();
			pendingOauth.set(state, { provider, verifier: `${device.deviceCode}|${device.clientId}|${device.clientSecret}`, expires: Date.now() + device.expiresIn * 1000 });
			return { flow: "device", userCode: device.userCode, verificationUri: device.verificationUri, state, interval: device.interval };
		}
		const { verifier, challenge } = pkcePair();
		const state = crypto.randomUUID();
		pendingOauth.set(state, { provider, verifier, expires: Date.now() + 15 * 60 * 1000 });
		const url = authorizeUrl(provider, challenge, state);
		return { flow: "pkce", authorizeUrl: url, state, hint: "Copy code param from redirect URL." };
	}

	async exchangeOauth(provider: ProviderId, state: string, code?: string, actorId?: string) {
		const entry = pendingOauth.get(state);
		if (!entry || entry.provider !== provider || entry.expires < Date.now()) throw new Error("invalid_state");
		pendingOauth.delete(state);

		let tokens: { accessToken: string; refreshToken?: string; expiresIn: number; extra?: Record<string, unknown> };
		if (provider === "kiro") {
			const [deviceCode, clientId, clientSecret] = entry.verifier.split("|");
			const result = await kiroDevicePoll(deviceCode!, clientId!, clientSecret!);
			if ("pending" in result) return { pending: true };
			tokens = result;
		} else {
			tokens = await exchangeCode(provider, code || "", entry.verifier);
		}

		const conn = await this.importConnection({
			provider,
			label: `${provider}-${Date.now().toString().slice(-4)}`,
			priority: 50,
			tokens: {
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken,
				expiresAt: Date.now() + tokens.expiresIn * 1000,
				...tokens.extra,
			},
		}, actorId);

		return { ok: true, connection: conn };
	}
}

export const connectionService = new ConnectionService();
