import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth/guards.js";
import { mcpRepo } from "../repositories/mcp.repository.js";
import { MCP_TEMPLATES, pingMcpServer } from "../services/mcp.service.js";

const createMcpSchema = z.object({
	name: z.string().trim().min(1).max(100),
	transport: z.enum(["sse", "http", "stdio"]).default("sse"),
	url: z.string().url().optional().or(z.literal("")),
	command: z.string().optional(),
	args: z.array(z.string()).optional(),
	env: z.record(z.string()).optional(),
});

export function mcpRoutes() {
	const app = new Hono();
	app.use("/api/mcp/*", requireAuth());

	app.get("/api/mcp/servers", async (c) => {
		const user = c.get("user");
		const servers = await mcpRepo.listByUser(user.id);
		return c.json({
			servers,
			templates: MCP_TEMPLATES,
		});
	});

	app.post("/api/mcp/servers", async (c) => {
		const user = c.get("user");
		const body = await c.req.json().catch(() => ({}));
		const parsed = createMcpSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
		}

		const data = parsed.data;
		const server = await mcpRepo.create({
			userId: user.id,
			name: data.name,
			transport: data.transport,
			url: data.url || null,
			command: data.command || null,
			args: data.args ? JSON.stringify(data.args) : null,
			env: data.env ? JSON.stringify(data.env) : null,
			status: "disconnected",
			enabled: true,
			toolsCount: 0,
			lastPingAt: null,
		});

		// Attempt background ping
		void pingMcpServer(server).catch(() => {});
		return c.json({ server }, 201);
	});

	app.post("/api/mcp/servers/:id/ping", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		const server = await mcpRepo.findById(id, user.id);
		if (!server) return c.json({ error: "not_found" }, 404);

		const result = await pingMcpServer(server);
		const updated = await mcpRepo.findById(id, user.id);
		return c.json({ result, server: updated });
	});

	app.patch("/api/mcp/servers/:id", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		const server = await mcpRepo.findById(id, user.id);
		if (!server) return c.json({ error: "not_found" }, 404);

		const body = await c.req.json().catch(() => ({}));
		const updateData: Record<string, unknown> = {};

		if (typeof body.name === "string" && body.name.trim()) updateData.name = body.name.trim().slice(0, 100);
		if (typeof body.enabled === "boolean") updateData.enabled = body.enabled;
		if (typeof body.url === "string") updateData.url = body.url.trim() || null;
		if (typeof body.command === "string") updateData.command = body.command.trim() || null;
		if (Array.isArray(body.args)) updateData.args = JSON.stringify(body.args);
		if (body.env && typeof body.env === "object") updateData.env = JSON.stringify(body.env);

		const updated = await mcpRepo.update(id, user.id, updateData);
		return c.json({ server: updated });
	});

	app.delete("/api/mcp/servers/:id", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		const ok = await mcpRepo.delete(id, user.id);
		return ok ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
	});

	return app;
}
