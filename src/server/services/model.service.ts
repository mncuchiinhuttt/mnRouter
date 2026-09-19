import { modelRepo, connectionRepo } from "../repositories/model.repository.js";
import { userRepo } from "../repositories/user.repository.js";
import { DEFAULT_MODELS } from "../gateway/models.js";
import type { ModelRow, User } from "@db/schema";
import type { ProviderId } from "../gateway/registry.js";

export class ModelService {
	async seedModels(): Promise<void> {
		const defaults = DEFAULT_MODELS.map((model) => ({
			...model,
			priceCacheRead: model.priceCacheRead ?? Math.round(model.priceIn * 0.1),
			priceCacheWrite: model.priceCacheWrite ?? Math.round(model.priceIn * 1.25),
		}));

		const inserted = await modelRepo.insertMissing(defaults);
		if (inserted > 0) {
			console.log(`[seed] inserted ${inserted} new default models`);
		}
		try {
			await modelRepo.update("claude-sonnet-5-ag", { enabled: false });
		} catch {}
		// Backfill only zero-valued legacy base prices
		for (const m of defaults) {
			if (m.priceIn > 0 || m.priceOut > 0) {
				const existing = await modelRepo.findById(m.id);
				if (existing && existing.priceIn === 0 && existing.priceOut === 0) {
					await modelRepo.update(m.id, { priceIn: m.priceIn, priceOut: m.priceOut });
				}
			}
			const existing = await modelRepo.findById(m.id);
			if (existing && existing.contextWindow !== m.contextWindow) {
				await modelRepo.update(m.id, { contextWindow: m.contextWindow });
			}
		}
		const openCodeConns = await connectionRepo.findActiveByProvider("opencode");
		if (openCodeConns.length === 0) {
			await connectionRepo.create({
				id: crypto.randomUUID(),
				provider: "opencode",
				label: "opencode-free",
				authType: "none",
				priority: 10,
				isActive: true,
				status: "active",
				data: {},
			});
			console.log("[seed] created opencode-free connection");
		}
	}

	async resolveModel(raw: string | undefined): Promise<{
		id: string;
		provider: ProviderId;
		upstreamModel: string;
		priceIn: number;
		priceOut: number;
		priceCacheRead: number;
		priceCacheWrite: number;
	} | null> {
		if (!raw) return null;
		const id = raw.includes("/") ? raw.split("/").slice(1).join("/") : raw;
		const row = await modelRepo.findEnabledById(id);
		if (!row) return null;

		return {
			id: row.id,
			provider: row.provider as ProviderId,
			upstreamModel: row.upstreamModel,
			priceIn: row.priceIn,
			priceOut: row.priceOut,
			priceCacheRead: row.priceCacheRead,
			priceCacheWrite: row.priceCacheWrite,
		};
	}

	async listModelsForUser(user?: Pick<User, "id" | "allModels"> | null): Promise<ModelRow[]> {
		let rows = await modelRepo.listEnabled();
		if (user && !user.allModels) {
			const allowedIds = new Set(await modelRepo.getUserModelIds(user.id));
			rows = rows.filter((m) => allowedIds.has(m.id));
		}
		const allConns = await connectionRepo.listAll();
		const connected = new Set(allConns.filter((c) => c.isActive && c.status === "active").map((c) => c.provider));
		connected.add("opencode");
		return rows.filter((m) => connected.has(m.provider as any));
	}

	async listAllModels(onlyActive = false): Promise<ModelRow[]> {
		if (onlyActive) {
			return this.listModelsForUser(null);
		}
		return modelRepo.listAll();
	}

	async updateModel(id: string, data: Partial<ModelRow>): Promise<ModelRow | null> {
		return modelRepo.update(id, data);
	}

	async getUserModelAccess(userId: string): Promise<{ allModels: boolean; modelIds: string[] } | null> {
		const user = await userRepo.findById(userId);
		if (!user) return null;
		const modelIds = await modelRepo.getUserModelIds(userId);
		return { allModels: user.allModels, modelIds };
	}

	async setUserModelAccess(userId: string, allModels: boolean, modelIds: string[]): Promise<boolean> {
		const user = await userRepo.findById(userId);
		if (!user) return false;

		const validIds = await modelRepo.validateModelIds(modelIds);
		if (!validIds) throw new Error("invalid_models");

		await userRepo.update(userId, { allModels });
		await modelRepo.setUserModels(userId, allModels ? [] : validIds);
		return true;
	}
}

export const modelService = new ModelService();
