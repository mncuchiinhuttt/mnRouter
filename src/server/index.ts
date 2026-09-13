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
import { sessionMiddleware } from "./auth/guards.js";
import { startRefresher, stopRefresher } from "./gateway/refresher.js";

const app = new Hono();

app.use("*", sessionMiddleware());

app.get("/healthz", (c) => c.json({ ok: true, uptime: process.uptime(), runtime: "bun" }));

app.route("/", authRoutes());
app.route("/", userRoutes());
app.route("/", adminRoutes());
app.route("/", gatewayRoutes());

// static web (built SPA)
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
	startRefresher();
})();

for (const sig of ["SIGINT", "SIGTERM"] as const) {
	process.on(sig, () => {
		console.log(`[mnrouter] ${sig} — shutting down`);
		stopRefresher();
		server.stop(true);
		process.exit(0);
	});
}
