import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "@auth/guards.js";
import { copilotService } from "@services/copilot.service.js";

const askSchema = z.object({
	query: z.string().trim().min(1).max(1000),
	lang: z.string().default("vi"),
	currentPath: z.string().default("/"),
});

export function copilotRoutes() {
	const app = new Hono();
	app.use("/api/copilot/*", requireAuth());

	app.post("/api/copilot/ask", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const parsed = askSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "invalid_query" }, 400);
		}

		const user = c.get("user");
		const reply = await copilotService.ask(
			parsed.data.query,
			user?.role || "user",
			parsed.data.lang,
			parsed.data.currentPath
		);
	});

	return app;
}
