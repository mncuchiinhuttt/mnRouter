import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@db";
import { models, userModels, providerConnections, type ModelRow, type ProviderConnection } from "@db/schema";

export class ModelRepository {
	async findById(id: string): Promise<ModelRow | null> {
		const [m] = await db.select().from(models).where(eq(models.id, id));
		return m ?? null;
	}

	async findEnabledById(id: string): Promise<ModelRow | null> {
		const [m] = await db.select().from(models).where(and(eq(models.id, id), eq(models.enabled, true)));
		if (!m || m.provider === "grok") return null;
		return m;
	}

	async listAll(): Promise<ModelRow[]> {
		const rows = await db.select().from(models).orderBy(asc(models.priority));
		return rows.filter((m) => m.provider !== "grok");
	}

	async listEnabled(): Promise<ModelRow[]> {
		const rows = await db.select().from(models).where(eq(models.enabled, true)).orderBy(asc(models.priority));
		return rows.filter((m) => m.provider !== "grok");
	}

	async insertMissing(items: (typeof models.$inferInsert)[]): Promise<number> {
		const existing = await db.select({ id: models.id }).from(models);
		const have = new Set(existing.map((r) => r.id));
		const missing = items.filter((m) => !have.has(m.id));
		if (missing.length > 0) {
			await db.insert(models).values(missing);
		}
		return missing.length;
	}

	async update(id: string, data: Partial<Omit<ModelRow, "id" | "createdAt">>): Promise<ModelRow | null> {
		const [updated] = await db.update(models).set(data).where(eq(models.id, id)).returning();
		return updated ?? null;
	}

	async getUserModelIds(userId: string): Promise<string[]> {
		const rows = await db.select({ modelId: userModels.modelId }).from(userModels).where(eq(userModels.userId, userId));
		return rows.map((r) => r.modelId);
	}

	async setUserModels(userId: string, modelIds: string[]): Promise<void> {
		await db.transaction(async (tx) => {
			await tx.delete(userModels).where(eq(userModels.userId, userId));
			if (modelIds.length > 0) {
				await tx.insert(userModels).values(modelIds.map((modelId) => ({ userId, modelId })));
			}
		});
	}

	async validateModelIds(modelIds: string[]): Promise<string[] | null> {
		const unique = [...new Set(modelIds.filter(Boolean))];
		if (unique.length === 0) return unique;
		const rows = await db.select({ id: models.id }).from(models).where(inArray(models.id, unique));
		return rows.length === unique.length ? unique : null;
	}
}

export class ConnectionRepository {
	async listAll(): Promise<ProviderConnection[]> {
		return db.select().from(providerConnections).orderBy(asc(providerConnections.provider), asc(providerConnections.priority));
	}

	async findActiveByProvider(provider: string): Promise<ProviderConnection[]> {
		return db
			.select()
			.from(providerConnections)
			.where(and(eq(providerConnections.provider, provider as any), eq(providerConnections.isActive, true)))
			.orderBy(asc(providerConnections.priority));
	}

	async findById(id: string): Promise<ProviderConnection | null> {
		const [conn] = await db.select().from(providerConnections).where(eq(providerConnections.id, id));
		return conn ?? null;
	}

	async create(data: typeof providerConnections.$inferInsert): Promise<ProviderConnection> {
		const [created] = await db.insert(providerConnections).values(data).returning();
		return created!;
	}

	async update(id: string, data: Partial<ProviderConnection>): Promise<ProviderConnection | null> {
		const [updated] = await db.update(providerConnections).set({ ...data, updatedAt: new Date() }).where(eq(providerConnections.id, id)).returning();
		return updated ?? null;
	}

	async delete(id: string): Promise<boolean> {
		const [deleted] = await db.delete(providerConnections).where(eq(providerConnections.id, id)).returning({ id: providerConnections.id });
		return Boolean(deleted);
	}
}

export const modelRepo = new ModelRepository();
export const connectionRepo = new ConnectionRepository();
