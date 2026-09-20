// Polyfill DOMMatrix, Path2D, and ImageData for headless Linux environments (used by pdf/canvas parsers)
if (typeof (globalThis as any).DOMMatrix === "undefined") {
	(globalThis as any).DOMMatrix = class DOMMatrix {
		a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
		m11 = 1; m12 = 0; m13 = 0; m14 = 0;
		m21 = 0; m22 = 1; m23 = 0; m24 = 0;
		m31 = 0; m32 = 0; m33 = 1; m34 = 0;
		m41 = 0; m42 = 0; m43 = 0; m44 = 1;
		is2D = true; isIdentity = true;
		inverse() { return this; }
		multiply() { return this; }
		translate() { return this; }
		scale() { return this; }
		rotate() { return this; }
		transformPoint(p: any) { return p; }
	};
}
if (typeof (globalThis as any).Path2D === "undefined") {
	(globalThis as any).Path2D = class Path2D {};
}
if (typeof (globalThis as any).ImageData === "undefined") {
	(globalThis as any).ImageData = class ImageData {
		width = 0; height = 0; data = new Uint8ClampedArray(0);
	};
}

import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { env, isProd } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/user.js";
import { adminRoutes, seedModels } from "./routes/admin.js";
import { gatewayRoutes } from "./routes/gateway.js";
import { setupScriptRoutes } from "./routes/setup-scripts.js";
import { announcementRoutes } from "./routes/announcements.js";
import { chatRoutes } from "./routes/chat.js";
import { adminQuotaRoutes } from "./routes/admin-quotas.js";
import { adminAnalyticsRoutes } from "./routes/admin-analytics.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { feedbackRoutes } from "./routes/feedback.js";
import { mcpRoutes } from "./routes/mcp.js";
import { customSkillRoutes } from "./routes/custom-skills.js";
import { statusRoutes } from "./routes/status.js";
import { copilotRoutes } from "./routes/copilot.js";
import { issueRoutes } from "./routes/issue.js";
import { sessionMiddleware } from "./auth/guards.js";
import { startRefresher, stopRefresher } from "./gateway/refresher.js";
import { startProber, stopProber } from "./gateway/prober.js";
import { startChatSweeper, stopChatSweeper } from "./chat/sweeper.js";
import { userRepo } from "./repositories/user.repository.js";
import { telegramBackupService } from "./services/telegram-backup.service.js";
const app = new Hono();

app.use("*", sessionMiddleware());

app.get("/healthz", (c) => c.json({ ok: true, uptime: process.uptime(), runtime: "bun" }));

app.route("/", authRoutes());
app.route("/", userRoutes());
app.route("/", adminRoutes());
app.route("/", gatewayRoutes());
app.route("/", setupScriptRoutes());
app.route("/", announcementRoutes());
app.route("/", chatRoutes());
app.route("/", adminQuotaRoutes());
app.route("/", adminAnalyticsRoutes());
app.route("/", leaderboardRoutes());
app.route("/", feedbackRoutes());
app.route("/", mcpRoutes());
app.route("/", customSkillRoutes());
app.route("/", statusRoutes());
app.route("/", copilotRoutes());
app.route("/", issueRoutes());
const webDist = path.resolve(process.cwd(), "web-dist");
if (existsSync(webDist)) {
	app.use("*", serveStatic({ root: path.relative(process.cwd(), webDist) }));
	app.get("*", async (c) => {
		try {
			const html = await readFile(path.join(webDist, "index.html"), "utf8");
			return c.html(html);
		} catch {
			return c.text("web build not found — run `bun run build`", 404);
		}
	});
}

const server = Bun.serve({
	fetch: app.fetch,
	port: env.PORT,
	// LLM streams có thể nghỉ lâu giữa các chunk — tắt idle timeout
	idleTimeout: 0,
});

console.log(`[mnrouter] listening on http://127.0.0.1:${server.port} (runtime=bun, prod=${isProd})`);

void (async () => {
	try {
		await seedModels();
	} catch (err) {
		console.error("[boot] seed failed:", (err as Error).message);
	}
	if (env.ADMIN_EMAIL) {
		try {
			const existing = await userRepo.findByEmail(env.ADMIN_EMAIL);
			if (!existing) {
				await userRepo.create({
					email: env.ADMIN_EMAIL.toLowerCase().trim(),
					role: "admin",
					maxApiKeys: 10,
				});
				console.log(`[boot] auto-seeded admin user: ${env.ADMIN_EMAIL}`);
			}
		} catch (err) {
			console.error("[boot] admin seed failed:", (err as Error).message);
		}
	}
	startRefresher();
	startProber();
	startChatSweeper();
	telegramBackupService.startSchedule();
})();

for (const sig of ["SIGINT", "SIGTERM"] as const) {
	process.on(sig, () => {
		console.log(`[mnrouter] ${sig} — shutting down`);
		stopRefresher();
		stopProber();
		stopChatSweeper();
		telegramBackupService.stopSchedule();
		process.exit(0);
	});
}
