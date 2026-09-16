import { Hono } from "hono";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@db";
import { chatFeedbacks } from "@db/schema";
import { requireAuth, requireAdmin } from "../auth/guards.js";

export function feedbackRoutes() {
	const app = new Hono();

	// 1. User submits feedback on a message
	app.post("/api/chat/messages/:id/feedback", requireAuth(), async (c) => {
		const user = c.get("user");
		const messageId = c.req.param("id");
		const body = await c.req.json().catch(() => ({}));
		const schema = z.object({
			threadId: z.string().min(1),
			reason: z.string().min(1).max(200),
			comment: z.string().max(2000).optional(),
			model: z.string().optional(),
			messagePreview: z.string().max(500).optional(),
		});
		const parsed = schema.safeParse(body);
		if (!parsed.success) return c.json({ error: "invalid_input" }, 400);

		const [created] = await db
			.insert(chatFeedbacks)
			.values({
				id: crypto.randomUUID(),
				messageId: messageId || "",
				threadId: parsed.data.threadId,
				userId: user.id,
				userEmail: user.email,
				model: parsed.data.model || null,
				reason: parsed.data.reason,
				comment: parsed.data.comment || null,
				messagePreview: parsed.data.messagePreview || null,
				status: "new",
				createdAt: new Date(),
			})
			.returning();

		return c.json({ ok: true, feedback: created }, 201);
	});

	// 2. Admin retrieves all feedbacks
	app.get("/api/admin/feedbacks", requireAdmin(), async (c) => {
		const status = c.req.query("status");
		const q = c.req.query("q")?.trim().toLowerCase();

		let baseQuery = db.select().from(chatFeedbacks);
		const conditions = [];

		if (status && status !== "all") {
			conditions.push(eq(chatFeedbacks.status, status as any));
		}
		if (q) {
			conditions.push(sql`${chatFeedbacks.comment} LIKE ${`%${q}%`} OR ${chatFeedbacks.userEmail} LIKE ${`%${q}%`} OR ${chatFeedbacks.reason} LIKE ${`%${q}%`}`);
		}

		const rows = await baseQuery
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(chatFeedbacks.createdAt))
			.limit(200);

		// Summary stats
		const [stats] = await db
			.select({
				total: sql<number>`COUNT(*)`,
				newCount: sql<number>`COALESCE(SUM(CASE WHEN ${chatFeedbacks.status} = 'new' THEN 1 ELSE 0 END), 0)`,
				resolvedCount: sql<number>`COALESCE(SUM(CASE WHEN ${chatFeedbacks.status} = 'resolved' THEN 1 ELSE 0 END), 0)`,
			})
			.from(chatFeedbacks);

		return c.json({
			feedbacks: rows,
			summary: {
				total: Number(stats?.total || 0),
				newCount: Number(stats?.newCount || 0),
				resolvedCount: Number(stats?.resolvedCount || 0),
			},
		});
	});

	// 3. Admin updates feedback status
	app.patch("/api/admin/feedbacks/:id", requireAdmin(), async (c) => {
		const id = c.req.param("id");
		if (!id) return c.json({ error: "missing_id" }, 400);
		const body = await c.req.json().catch(() => ({}));
		const schema = z.object({
			status: z.enum(["new", "reviewed", "resolved"]),
		});
		const parsed = schema.safeParse(body);
		if (!parsed.success) return c.json({ error: "invalid_input" }, 400);

		const [updated] = await db
			.update(chatFeedbacks)
			.set({ status: parsed.data.status })
			.where(eq(chatFeedbacks.id, id))
			.returning();

		return updated ? c.json({ ok: true, feedback: updated }) : c.json({ error: "not_found" }, 404);
	});

	// 4. Admin deletes feedback
	app.delete("/api/admin/feedbacks/:id", requireAdmin(), async (c) => {
		const id = c.req.param("id");
		if (!id) return c.json({ error: "missing_id" }, 400);
		const [deleted] = await db.delete(chatFeedbacks).where(eq(chatFeedbacks.id, id)).returning();
		return deleted ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
	});

	return app;
}
