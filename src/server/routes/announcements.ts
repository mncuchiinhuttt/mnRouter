import { Hono } from "hono";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../auth/guards.js";
import { announcementService } from "../services/announcement.service.js";

const announcementSchema = z.object({
	title: z.string().trim().min(1).max(200),
	content: z.string().trim().min(1).max(2000),
	type: z.enum(["info", "warning", "maintenance", "success"]).default("info"),
	active: z.boolean().default(true),
	expiresAt: z.string().datetime().nullable().optional(),
});

export function announcementRoutes() {
	const app = new Hono();

	// Any authenticated user can view active announcements for their overview dashboard
	app.get("/api/announcements", requireAuth(), async (c) => {
		const list = await announcementService.getActiveAnnouncements();
		return c.json({ announcements: list });
	});

	// Admin management endpoints
	app.use("/api/admin/announcements/*", requireAdmin());
	app.use("/api/admin/announcements", requireAdmin());

	app.get("/api/admin/announcements", async (c) => {
		const list = await announcementService.listAllAnnouncements();
		return c.json({ announcements: list });
	});

	app.post("/api/admin/announcements", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const parsed = announcementSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
		}

		const data = {
			...parsed.data,
			expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
		};

		const created = await announcementService.createAnnouncement(data, c.get("user").id);
		return c.json({ announcement: created }, 201);
	});

	app.patch("/api/admin/announcements/:id", async (c) => {
		const body = await c.req.json().catch(() => ({}));
		const schema = announcementSchema.partial();
		const parsed = schema.safeParse(body);
		if (!parsed.success) {
			return c.json({ error: "invalid_input", details: parsed.error.flatten() }, 400);
		}

		const data = {
			...parsed.data,
			expiresAt: parsed.data.expiresAt !== undefined
				? (parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null)
				: undefined,
		};

		const updated = await announcementService.updateAnnouncement(c.req.param("id"), data, c.get("user").id);
		return updated ? c.json({ announcement: updated }) : c.json({ error: "not_found" }, 404);
	});

	app.delete("/api/admin/announcements/:id", async (c) => {
		const ok = await announcementService.deleteAnnouncement(c.req.param("id"), c.get("user").id);
		return ok ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
	});

	return app;
}
