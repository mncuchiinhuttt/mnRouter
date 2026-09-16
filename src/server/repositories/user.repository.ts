import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@db";
import { users, apiKeys, usageDaily, type User, type ApiKey } from "@db/schema";

export class UserRepository {
	async findById(id: string): Promise<User | null> {
		const [user] = await db.select().from(users).where(eq(users.id, id));
		return user ?? null;
	}

	async findByEmail(email: string): Promise<User | null> {
		const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
		return user ?? null;
	}

	async findByUsername(username: string): Promise<User | null> {
		const [user] = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
		return user ?? null;
	}

	async create(data: {
		id?: string;
		email: string;
		role?: "admin" | "user";
		displayName?: string | null;
		packageName?: string | null;
		maxApiKeys?: number;
		monthlyTokenBudget?: number | null;
		monthlyCreditBudget?: number | null;
		allModels?: boolean;
	}): Promise<User> {
		const [created] = await db
			.insert(users)
			.values({
				id: data.id ?? crypto.randomUUID(),
				email: data.email.toLowerCase(),
				role: data.role ?? "user",
				displayName: data.displayName,
				packageName: data.packageName,
				maxApiKeys: data.maxApiKeys ?? 1,
				monthlyTokenBudget: data.monthlyTokenBudget,
				monthlyCreditBudget: data.monthlyCreditBudget,
				allModels: data.allModels ?? true,
			})
			.returning();
		return created!;
	}

	async update(id: string, data: Partial<Omit<User, "id" | "createdAt">>): Promise<User | null> {
		const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
		return updated ?? null;
	}

	async delete(id: string): Promise<boolean> {
		const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
		return !!deleted;
	}

	async listAll(): Promise<(User & { activeKeys: number; totalCredits: number })[]> {
		const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
		const activeKeys = await db
			.select({ userId: apiKeys.userId, activeCount: count(apiKeys.id) })
			.from(apiKeys)
			.where(isNull(apiKeys.revokedAt))
			.groupBy(apiKeys.userId);

		const userCredits = await db
			.select({
				userId: usageDaily.userId,
				totalCredits: sql<number>`COALESCE(SUM(CAST(${usageDaily.credits} AS NUMERIC)), 0)`,
			})
			.from(usageDaily)
			.groupBy(usageDaily.userId);

		const activeKeysMap = new Map(activeKeys.map((r) => [r.userId, r.activeCount]));
		const userCreditsMap = new Map(userCredits.map((r) => [r.userId, Math.round((Number(r.totalCredits) || 0) * 10000) / 10000]));

		return allUsers.map((u) => ({
			...u,
			activeKeys: activeKeysMap.get(u.id) ?? 0,
			totalCredits: userCreditsMap.get(u.id) ?? 0,
		}));
	}

	async countUsers(): Promise<number> {
		const [res] = await db.select({ total: count(users.id) }).from(users);
		return res?.total ?? 0;
	}
}

export class KeyRepository {
	async findById(id: string): Promise<ApiKey | null> {
		const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
		return key ?? null;
	}

	async findByHash(keyHash: string): Promise<(ApiKey & { user: User }) | null> {
		const [row] = await db
			.select()
			.from(apiKeys)
			.innerJoin(users, eq(users.id, apiKeys.userId))
			.where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)));
		if (!row) return null;
		return { ...row.api_keys, user: row.users };
	}

	async findActiveByUserId(userId: string): Promise<ApiKey[]> {
		return db.select().from(apiKeys).where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
	}

	async countActiveByUserId(userId: string): Promise<number> {
		const [res] = await db
			.select({ total: count(apiKeys.id) })
			.from(apiKeys)
			.where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
		return res?.total ?? 0;
	}

	async create(data: {
		id?: string;
		userId: string;
		name?: string;
		prefix: string;
		keyHash: string;
		createdBy?: string | null;
	}): Promise<ApiKey> {
		const [created] = await db
			.insert(apiKeys)
			.values({
				id: data.id ?? crypto.randomUUID(),
				userId: data.userId,
				name: data.name ?? "default",
				prefix: data.prefix,
				keyHash: data.keyHash,
				createdBy: data.createdBy,
			})
			.returning();
		return created!;
	}

	async updateLastUsed(id: string): Promise<void> {
		await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
	}

	async revoke(id: string, userId?: string): Promise<boolean> {
		const condition = userId ? and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)) : eq(apiKeys.id, id);
		const [res] = await db.update(apiKeys).set({ revokedAt: new Date() }).where(condition).returning({ id: apiKeys.id });
		return Boolean(res);
	}

	async listByUserId(userId: string): Promise<ApiKey[]> {
		return db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
	}

	async listAllWithUser(): Promise<(ApiKey & { userEmail: string })[]> {
		const rows = await db
			.select({
				id: apiKeys.id,
				userId: apiKeys.userId,
				name: apiKeys.name,
				prefix: apiKeys.prefix,
				keyHash: apiKeys.keyHash,
				createdBy: apiKeys.createdBy,
				createdAt: apiKeys.createdAt,
				lastUsedAt: apiKeys.lastUsedAt,
				revokedAt: apiKeys.revokedAt,
				userEmail: users.email,
			})
			.from(apiKeys)
			.innerJoin(users, eq(users.id, apiKeys.userId))
			.orderBy(desc(apiKeys.createdAt));
		return rows;
	}
}

export const userRepo = new UserRepository();
export const keyRepo = new KeyRepository();
