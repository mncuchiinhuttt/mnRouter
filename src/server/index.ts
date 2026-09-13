import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
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

app.get("/healthz", (c) => c.json({ ok: true, uptime: process.uptime() }));

app.route("/", authRoutes());
app.route("/", userRoutes());
app.route("/", adminRoutes());
app.route("/", gatewayRoutes());

// static web (built SPA)
const webDist = path.resolve(process.cwd(), isProd ? "web-dist" : "web-dist");
if (existsSync(webDist)) {
	app.use("*", serveStatic({ root: path.relative(process.cwd(), webDist) }));
	app.get("*", async (c) => {
		try {
			const html = await readFile(path.join(webDist, "index.html"), "utf8");
			return c.html(html);
		} catch {
			return c.text("web build not found — run `pnpm build`", 404);
		}
	});
}

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
	console.log(`[mnrouter] listening on http://127.0.0.1:${info.port} (prod=${isProd})`);
});

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
		server.close(() => process.exit(0));
		setTimeout(() => process.exit(0), 3000).unref();
	});
}
