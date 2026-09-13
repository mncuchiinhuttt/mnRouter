import { Hono } from "hono";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { apiKeys } from "../db/schema.js";
import { requireAuth } from "../auth/guards.js";
import { generateApiKey } from "../auth/crypto.js";
import { usageSummary, monthlyTokensForUser, monthlyCreditsForUser } from "../usage/index.js";

export function userRoutes() {
	const app = new Hono();
	app.use("/api/me/*", requireAuth());

	app.get("/api/me/keys", async (c) => {
		const user = c.get("user");
		const rows = await db.select().from(apiKeys).where(eq(apiKeys.userId, user.id)).orderBy(desc(apiKeys.createdAt));
		return c.json({
			keys: rows.map((k) => ({
				id: k.id,
				name: k.name,
				prefix: k.prefix,
				createdAt: k.createdAt,
				lastUsedAt: k.lastUsedAt,
				revokedAt: k.revokedAt,
				active: !k.revokedAt,
			})),
			maxKeys: user.maxApiKeys,
		});
	});

	/** Rotate: tạo key mới + thu cũ — trả plaintext đúng 1 lần. */
	app.post("/api/me/keys/:id/rotate", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		const [existing] = await db
			.select()
			.from(apiKeys)
			.where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)));
		if (!existing) return c.json({ error: "key_not_found" }, 404);
		const { key, hash, prefix } = generateApiKey();
		const [created] = await db
			.insert(apiKeys)
			.values({ userId: user.id, name: existing.name, prefix, keyHash: hash, createdBy: user.id })
			.returning();
		await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
		return c.json({ key, id: created!.id, prefix, message: "Key cũ đã bị thu hồi. Lưu key mới ngay — chỉ hiện 1 lần." });
	});

	app.post("/api/me/keys/:id/revoke", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		await db
			.update(apiKeys)
			.set({ revokedAt: new Date() })
			.where(and(eq(apiKeys.id, id), eq(apiKeys.userId, user.id)));
		return c.json({ ok: true });
	});

	app.get("/api/me/usage", async (c) => {
		const user = c.get("user");
		const summary = await usageSummary(user.id);
		const usedThisMonth = await monthlyTokensForUser(user.id);
		const usedCreditsThisMonth = await monthlyCreditsForUser(user.id);
		return c.json({ ...summary, budget: user.monthlyTokenBudget, usedThisMonth, creditBudget: user.monthlyCreditBudget, usedCreditsThisMonth });
	});

	return app;
}
