import { generateApiKey } from "../auth/crypto.js";
import { userRepo, keyRepo } from "../repositories/user.repository.js";
import { sessionRepo } from "../repositories/invitation.repository.js";
import { modelRepo } from "../repositories/model.repository.js";
import { auditRepo } from "../repositories/usage.repository.js";
import type { User, ApiKey } from "@db/schema";

export class UserService {
	async createUser(data: {
		email: string;
		displayName?: string | null;
		packageName?: string | null;
		maxApiKeys?: number;
		monthlyCreditBudget?: number | null;
		allModels?: boolean;
		allowedModels?: string[];
	}, actorId?: string): Promise<User> {
		const existing = await userRepo.findByEmail(data.email);
		if (existing) throw new Error("email_exists");

		const validModels = await modelRepo.validateModelIds(data.allowedModels ?? []);
		if (!validModels) throw new Error("invalid_models");

		const user = await userRepo.create({
			email: data.email,
			displayName: data.displayName,
			packageName: data.packageName,
			maxApiKeys: data.maxApiKeys,
			monthlyCreditBudget: data.monthlyCreditBudget,
			allModels: data.allModels ?? true,
		});

		if (!data.allModels && validModels.length > 0) {
			await modelRepo.setUserModels(user.id, validModels);
		}

		if (actorId) {
			await auditRepo.record(actorId, "user.create", user.email, { maxApiKeys: user.maxApiKeys, packageName: user.packageName });
		}
		return user;
	}

	async updateUser(id: string, data: {
		maxApiKeys?: number;
		monthlyCreditBudget?: number | null;
		packageName?: string | null;
		status?: "active" | "disabled";
		displayName?: string | null;
	}, actorId?: string): Promise<User | null> {
		const patch: Partial<User> = { ...data };
		if (data.status === "disabled") {
			patch.disabledAt = new Date();
		} else if (data.status === "active") {
			patch.disabledAt = null;
		}

		const updated = await userRepo.update(id, patch);
		if (!updated) return null;

		if (data.status === "disabled") {
			await sessionRepo.deleteByUserId(id);
			const activeKeys = await keyRepo.findActiveByUserId(id);
			for (const k of activeKeys) {
				await keyRepo.revoke(k.id);
			}
		}

		if (actorId) {
			await auditRepo.record(actorId, "user.update", id, data);
		}
		return updated;
	}

	async deleteUser(id: string, actorId?: string): Promise<boolean> {
		const target = await userRepo.findById(id);
		if (!target) return false;
		await sessionRepo.deleteByUserId(id);
		const deleted = await userRepo.delete(id);
		if (deleted && actorId) {
			await auditRepo.record(actorId, "user.delete", id, { email: target.email, role: target.role });
		}
		return deleted;
	}

	async selfCreateApiKey(user: User, name?: string): Promise<{ key: string; id: string; prefix: string; name: string }> {
		if (user.status !== "active") throw new Error("account_disabled");

		const activeCount = await keyRepo.countActiveByUserId(user.id);
		if (activeCount >= user.maxApiKeys) {
			throw new Error("max_keys_reached");
		}

		const cleanName = String(name ?? "default").trim().slice(0, 50) || "default";
		const { key, hash, prefix } = generateApiKey();

		const created = await keyRepo.create({
			userId: user.id,
			name: cleanName,
			prefix,
			keyHash: hash,
			createdBy: user.id,
		});

		return { key, id: created.id, prefix, name: cleanName };
	}

	async adminCreateApiKey(userId: string, name?: string, actorId?: string): Promise<{ key: string; id: string; prefix: string; name: string }> {
		const target = await userRepo.findById(userId);
		if (!target) throw new Error("user_not_found");

		const activeCount = await keyRepo.countActiveByUserId(userId);
		if (activeCount >= target.maxApiKeys) {
			throw new Error("max_keys_reached");
		}

		const cleanName = String(name ?? "default").trim().slice(0, 50) || "default";
		const { key, hash, prefix } = generateApiKey();

		const created = await keyRepo.create({
			userId,
			name: cleanName,
			prefix,
			keyHash: hash,
			createdBy: actorId,
		});

		if (actorId) {
			await auditRepo.record(actorId, "key.create", created.id, { userId, name: cleanName });
		}
		return { key, id: created.id, prefix, name: cleanName };
	}

	async rotateApiKey(user: User, keyId: string): Promise<{ key: string; id: string; prefix: string }> {
		const existing = await keyRepo.findById(keyId);
		if (!existing || existing.userId !== user.id || existing.revokedAt) {
			throw new Error("key_not_found");
		}

		const { key, hash, prefix } = generateApiKey();
		const created = await keyRepo.create({
			userId: user.id,
			name: existing.name,
			prefix,
			keyHash: hash,
			createdBy: user.id,
		});

		await keyRepo.revoke(keyId, user.id);
		return { key, id: created.id, prefix };
	}

	async revokeApiKey(keyId: string, userId?: string, actorId?: string): Promise<boolean> {
		const success = await keyRepo.revoke(keyId, userId);
		if (success && actorId) {
			await auditRepo.record(actorId, "key.revoke", keyId);
		}
		return success;
	}

	async listUserKeys(userId: string) {
		const rows = await keyRepo.listByUserId(userId);
		return rows.map((k) => ({
			id: k.id,
			name: k.name,
			prefix: k.prefix,
			createdAt: k.createdAt,
			lastUsedAt: k.lastUsedAt,
			revokedAt: k.revokedAt,
			active: !k.revokedAt,
		}));
	}

	async listAllUsers() {
		return userRepo.listAll();
	}

	async listAllKeys() {
		return keyRepo.listAllWithUser();
	}
}

export const userService = new UserService();
