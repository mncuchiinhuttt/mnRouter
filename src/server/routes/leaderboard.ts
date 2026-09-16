import { Hono } from "hono";
import { and, desc, gte, sql } from "drizzle-orm";
import { db } from "@db";
import { usageRequests, users } from "@db/schema";
import { requireAuth } from "../auth/guards.js";

export function leaderboardRoutes() {
	const app = new Hono();
	app.use("/api/leaderboard", requireAuth());

	app.get("/api/leaderboard", async (c) => {
		const currentUser = c.get("user");
		const range = c.req.query("range") || "7d";
		const now = Date.now();
		let since: Date | null = null;
		if (range === "24h") since = new Date(now - 24 * 3600 * 1000);
		else if (range === "7d") since = new Date(now - 7 * 24 * 3600 * 1000);
		else if (range === "30d") since = new Date(now - 30 * 24 * 3600 * 1000);

		const whereClause = since ? gte(usageRequests.ts, since) : undefined;

		const userUsageRows = await db
			.select({
				userId: usageRequests.userId,
				displayName: users.displayName,
				username: users.username,
				department: users.department,
				avatarUrl: users.avatarUrl,
				packageName: users.packageName,
				role: users.role,
				promptTokens: sql<number>`COALESCE(SUM(${usageRequests.promptTokens}), 0)`,
				completionTokens: sql<number>`COALESCE(SUM(${usageRequests.completionTokens}), 0)`,
				credits: sql<number>`COALESCE(SUM(CAST(${usageRequests.credits} AS REAL)), 0)`,
				requests: sql<number>`COUNT(*)`,
				errors: sql<number>`COALESCE(SUM(CASE WHEN ${usageRequests.status} != 'ok' THEN 1 ELSE 0 END), 0)`,
				lastActive: sql<Date | null>`MAX(${usageRequests.ts})`,
			})
			.from(usageRequests)
			.leftJoin(users, sql`${usageRequests.userId} = ${users.id}`)
			.where(whereClause)
			.groupBy(usageRequests.userId)
			.orderBy(desc(sql`SUM(${usageRequests.promptTokens} + ${usageRequests.completionTokens})`));

		let myRank: { rank: number; totalTokens: number; credits: number; requests: number } | null = null;

		const leaderboard = userUsageRows.map((u, i) => {
			const prompt = Number(u.promptTokens || 0);
			const comp = Number(u.completionTokens || 0);
			const totalTokens = prompt + comp;
			const isMe = u.userId === currentUser.id;
			const rank = i + 1;

			if (isMe) {
				myRank = {
					rank,
					totalTokens,
					credits: Math.round(Number(u.credits || 0) * 10000) / 10000,
					requests: Number(u.requests || 0),
				};
			}

			return {
				rank,
				userId: u.userId || "anonymous",
				displayName: u.displayName || (u.username ? `@${u.username}` : "User"),
				username: u.username || null,
				department: u.department || null,
				avatarUrl: u.avatarUrl || null,
				packageName: u.packageName,
				role: u.role || "user",
				totalTokens,
				promptTokens: prompt,
				completionTokens: comp,
				credits: Math.round(Number(u.credits || 0) * 10000) / 10000,
				requests: Number(u.requests || 0),
				errors: Number(u.errors || 0),
				lastActive: u.lastActive ? new Date(u.lastActive).toISOString() : null,
				isCurrentUser: isMe,
			};
		});

		return c.json({
			range,
			leaderboard,
			myRank,
			totalParticipants: leaderboard.length,
		});
	});

	return app;
}
