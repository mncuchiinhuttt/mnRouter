import { Hono } from "hono";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../auth/guards.js";
import { issueService } from "../services/issue.service.js";

const toolEnum = z.enum([
	"api",
	"claude_code",
	"codex",
	"omp",
	"chat",
	"cursor",
	"opencode",
	"other",
]);

export function issueRoutes() {
	const app = new Hono();

	// 1. Submit issue (Authenticated user or guest with optional email)
	app.post("/api/issues", async (c) => {
		const user = c.get("user") as { id: string; email: string } | undefined;
		const contentType = c.req.header("content-type") || "";

		let title = "";
		let description = "";
		let tool = "other";
		let customTool = "";
		let model = "";
		let userEmail = user?.email || "";
		const images: Array<{ filename: string; mimeType: string; buffer: Uint8Array }> = [];

		if (contentType.includes("multipart/form-data")) {
			const body = await c.req.parseBody({ all: true });
			title = String(body["title"] ?? "").trim();
			description = String(body["description"] ?? "").trim();
			tool = String(body["tool"] ?? "other").trim();
			customTool = String(body["customTool"] ?? "").trim();
			model = String(body["model"] ?? "").trim();
			if (!userEmail && body["email"]) {
				userEmail = String(body["email"]).trim();
			}

			// Handle single or multiple file uploads
			const rawFiles = body["images"] || body["files"] || body["image"];
			const fileArray = Array.isArray(rawFiles) ? rawFiles : rawFiles ? [rawFiles] : [];

			for (const f of fileArray) {
				if (f && typeof f === "object" && "arrayBuffer" in f && typeof (f as File).arrayBuffer === "function") {
					const file = f as File;
					const buf = new Uint8Array(await file.arrayBuffer());
					images.push({
						filename: file.name || "screenshot.png",
						mimeType: file.type || "image/png",
						buffer: buf,
					});
				}
			}
		} else {
			const json = await c.req.json().catch(() => ({}));
			title = String(json.title ?? "").trim();
			description = String(json.description ?? "").trim();
			tool = String(json.tool ?? "other").trim();
			customTool = String(json.customTool ?? "").trim();
			model = String(json.model ?? "").trim();
			if (!userEmail && json.email) {
				userEmail = String(json.email).trim();
			}
		}

		if (!title) {
			return c.json({ success: false, error: { code: "INVALID_INPUT", message: "Title is required" } }, 400);
		}
		if (!description) {
			return c.json({ success: false, error: { code: "INVALID_INPUT", message: "Description is required" } }, 400);
		}

		const parsedTool = toolEnum.safeParse(tool);
		const validTool = parsedTool.success ? parsedTool.data : "other";

		const issue = await issueService.createIssue({
			userId: user?.id ?? null,
			userEmail: userEmail || null,
			tool: validTool,
			customTool: customTool || null,
			title,
			description,
			model: model || null,
			images,
		});

		return c.json({ success: true, ok: true, data: issue }, 201);
	});

	// 2. Get user's submitted issues
	app.get("/api/issues/my", requireAuth(), async (c) => {
		const user = c.get("user");
		const list = await issueService.listUserIssues(user.id);
		return c.json({ success: true, ok: true, data: list, issues: list });
	});

	// 3. View single issue detail
	app.get("/api/issues/:id", async (c) => {
		const id = c.req.param("id");
		const issue = await issueService.getIssue(id);
		if (!issue) {
			return c.json({ success: false, error: { code: "NOT_FOUND", message: "Issue not found" } }, 404);
		}
		return c.json({ success: true, ok: true, data: issue });
	});

	// 4. Stream an issue image
	app.get("/api/issues/images/:id", async (c) => {
		const imageId = c.req.param("id");
		const res = await issueService.readImageBuffer(imageId);
		if (!res) {
			return c.json({ error: "not_found" }, 404);
		}

		return new Response(new Uint8Array(res.buffer), {
			status: 200,
			headers: {
				"content-type": res.image.mimeType,
				"cache-control": "public, max-age=86400",
			},
		});
	});

	// 5. Admin: List all issues with filtering
	app.get("/api/admin/issues", requireAdmin(), async (c) => {
		const status = c.req.query("status") || "all";
		const search = c.req.query("search") || c.req.query("q") || "";

		const res = await issueService.listAdminIssues({ status, search });
		return c.json({
			success: true,
			ok: true,
			data: res.issues,
			issues: res.issues,
			summary: res.summary,
		});
	});

	// 6. Admin: Update status or note (purges images when resolved!)
	app.patch("/api/admin/issues/:id", requireAdmin(), async (c) => {
		const id = c.req.param("id");
		if (!id) return c.json({ success: false, error: { code: "MISSING_ID" } }, 400);
		const body = await c.req.json().catch(() => ({}));
		const schema = z.object({
			status: z.enum(["open", "investigating", "resolved"]).optional(),
			adminNote: z.string().optional(),
		});

		const parsed = schema.safeParse(body);
		if (!parsed.success) {
			return c.json({ success: false, error: { code: "INVALID_INPUT", details: parsed.error.flatten() } }, 400);
		}

		const status = parsed.data.status ?? "open";
		const updated = await issueService.updateStatus(id, status, parsed.data.adminNote);
		if (!updated) {
			return c.json({ success: false, error: { code: "NOT_FOUND", message: "Issue not found" } }, 404);
		}

		return c.json({ success: true, ok: true, data: updated, issue: updated });
	});

	// 7. Admin: Delete issue
	app.delete("/api/admin/issues/:id", requireAdmin(), async (c) => {
		const id = c.req.param("id");
		if (!id) return c.json({ success: false, error: { code: "MISSING_ID" } }, 400);
		const ok = await issueService.deleteIssue(id);
		if (!ok) {
			return c.json({ success: false, error: { code: "NOT_FOUND", message: "Issue not found" } }, 404);
		}
		return c.json({ success: true, ok: true });
	});

	return app;
}
