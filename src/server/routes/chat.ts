import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth/guards.js";
import { chatService } from "../services/chat.service.js";
import { fileService, MAX_FILE_SIZE } from "../services/file.service.js";
import { chatRepo } from "../repositories/chat.repository.js";
import { userRepo } from "../repositories/user.repository.js";
import { modelService } from "../services/model.service.js";
import { compactService } from "../services/compact.service.js";
export function chatRoutes() {
	const app = new Hono();
	app.use("/api/chat/*", requireAuth());

	// ---------- Threads ----------
	app.get("/api/chat/threads", async (c) => c.json({ threads: await chatService.listThreads(c.get("user").id) }));
	app.get("/api/chat/models", async (c) => c.json({ models: await modelService.listModelsForUser(c.get("user")) }));


	app.post("/api/chat/threads", async (c) => {
		const user = c.get("user");
		const body = await c.req.json().catch(() => ({}));
		const schema = z.object({
			model: z.string().min(1),
			title: z.string().trim().max(100).optional(),
		});
		const parsed = schema.safeParse(body);
		if (!parsed.success) return c.json({ error: "invalid_input" }, 400);

		const thread = await chatService.createThread(user.id, parsed.data.model, parsed.data.title);
		return c.json({ thread }, 201);
	});

	app.get("/api/chat/threads/:id", async (c) => {
		const user = c.get("user");
		const threadId = c.req.param("id");
		const thread = await chatService.getThread(threadId, user.id);
		if (!thread) return c.json({ error: "not_found" }, 404);

		const { messages, artifacts } = await chatService.listMessages(threadId, user.id);
		return c.json({ thread, messages, artifacts });
	});

	app.patch("/api/chat/threads/:id", async (c) => {
		const user = c.get("user"), threadId = c.req.param("id"), body = await c.req.json().catch(() => ({}));
		const schema = z.object({ title: z.string().trim().max(100).optional(), model: z.string().min(1).optional(), notifyModelChange: z.string().optional() });
		const parsed = schema.safeParse(body);
		if (!parsed.success) return c.json({ error: "invalid_input" }, 400);
		if (parsed.data.notifyModelChange) {
			await chatRepo.createMessage({ threadId, role: "system", content: parsed.data.notifyModelChange });
		}
		const updated = await chatService.updateThread(threadId, user.id, { title: parsed.data.title, model: parsed.data.model });
		return updated ? c.json({ thread: updated }) : c.json({ error: "not_found" }, 404);
	});

	app.delete("/api/chat/threads/:id", async (c) => {
		const user = c.get("user");
		const threadId = c.req.param("id");
		const ok = await chatService.deleteThread(threadId, user.id);
		return ok ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
	});

	// ---------- Context Compactor (Claude Working Memory) ----------
	app.post("/api/chat/threads/:id/compact", async (c) => {
		const user = c.get("user");
		const threadId = c.req.param("id");
		try {
			const result = await compactService.compactThread(threadId, user);
			return c.json(result);
		} catch (err) {
			return c.json({ error: (err as Error).message || "compaction_failed" }, 400);
		}
	});
	app.post("/api/chat/threads/:id/messages", async (c) => {
		const user = c.get("user");
		const threadId = c.req.param("id");
		const body = await c.req.json().catch(() => ({}));
		const schema = z.object({
			content: z.string().min(1).max(50000),
			fileIds: z.array(z.string()).max(10).optional(),
			skillIds: z.array(z.string()).optional(),
			thinkingLevel: z.enum(["off", "low", "medium", "high", "xhigh", "max"]).optional(),
			webSearch: z.boolean().optional(),
		});
		const parsed = schema.safeParse(body);
		if (!parsed.success) return c.json({ error: "invalid_input" }, 400);

		try {
			const stream = await chatService.streamMessage({
				threadId, user, content: parsed.data.content, fileIds: parsed.data.fileIds,
				skillIds: parsed.data.skillIds, thinkingLevel: parsed.data.thinkingLevel, webSearch: parsed.data.webSearch,
			});

			return new Response(stream, {
				headers: {
					"content-type": "text/event-stream; charset=utf-8",
					"cache-control": "no-cache",
					connection: "keep-alive",
				},
			});
		} catch (err) {
			const msg = (err as Error).message;
			const status = msg.includes("credit_budget_exceeded") ? 429 : msg.includes("model_forbidden") ? 403 : msg.includes("not_found") ? 404 : 500;
			return c.json({ error: msg }, status);
		}
	});

	// ---------- Ephemeral File Uploads (Max 10MB, 24h TTL) ----------
	app.post("/api/chat/upload", async (c) => {
		const user = c.get("user");
		const formData = await c.req.parseBody();
		const file = formData["file"];
		const threadId = typeof formData["threadId"] === "string" ? formData["threadId"] : undefined;

		if (!(file instanceof File)) {
			return c.json({ error: "file_required" }, 400);
		}

		if (file.size > MAX_FILE_SIZE) {
			return c.json({ error: "file_too_large", maxBytes: MAX_FILE_SIZE }, 413);
		}

		try {
			const arrayBuffer = await file.arrayBuffer();
			const saved = await fileService.saveUpload({
				userId: user.id,
				threadId,
				filename: file.name,
				mimeType: file.type || "application/octet-stream",
				buffer: new Uint8Array(arrayBuffer),
			});

			return c.json({ file: saved }, 201);
		} catch (err) {
			return c.json({ error: (err as Error).message }, 400);
		}
	});

	app.get("/api/chat/files/:id", async (c) => {
		const user = c.get("user");
		const fileId = c.req.param("id");
		const fileRes = await fileService.readFileBuffer(fileId, user.id);
		if (!fileRes) return c.json({ error: "not_found" }, 404);

		return new Response(new Uint8Array(fileRes.buffer), {
			headers: {
				"content-type": fileRes.file.mimeType,
				"content-disposition": `inline; filename="${encodeURIComponent(fileRes.file.filename)}"`,
			},
		});
	});

	app.delete("/api/chat/files/:id", async (c) => {
		const user = c.get("user");
		const fileId = c.req.param("id");
		const ok = await fileService.deleteFile(fileId, user.id);
		return ok ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
	});

	// ---------- Ephemeral Artifacts ----------
	app.get("/api/chat/artifacts/:id", async (c) => {
		const id = c.req.param("id");
		const artifact = await chatRepo.findArtifactById(id);
		if (!artifact) return c.json({ error: "not_found" }, 404);
		return c.json({ artifact });
	});

	// ---------- Ephemeral 24h Share Links ----------
	app.get("/api/chat/threads/:id/shares", async (c) => {
		const thread = await chatRepo.findThreadById(c.req.param("id"), c.get("user").id);
		return thread ? c.json({ shares: await chatRepo.listSharesByThread(thread.id) }) : c.json({ error: "not_found" }, 404);
	});

	app.post("/api/chat/threads/:id/shares", async (c) => {
		const user = c.get("user");
		const thread = await chatRepo.findThreadById(c.req.param("id"), user.id);
		if (!thread) return c.json({ error: "not_found" }, 404);
		const token = `sh_${crypto.randomUUID().replace(/-/g, "")}`;
		const share = await chatRepo.createShare({
			threadId: thread.id, userId: user.id, token, title: thread.title, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
		});
		return c.json({ share }, 201);
	});

	app.delete("/api/chat/shares/:id", async (c) => (await chatRepo.deleteShare(c.req.param("id"), c.get("user").id)) ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404));

	// Public share viewer (no auth needed, expires in 24h)
	app.get("/api/share/:token", async (c) => {
		const share = await chatRepo.findShareByToken(c.req.param("token"));
		if (!share) return c.json({ error: "not_found_or_expired" }, 404);
		const thread = await chatRepo.findThreadById(share.threadId);
		if (!thread) return c.json({ error: "not_found" }, 404);
		const author = await userRepo.findById(share.userId);
		return c.json({
			share: { id: share.id, title: share.title, expiresAt: share.expiresAt },
			thread: { id: thread.id, title: thread.title, model: thread.model, createdAt: thread.createdAt },
			author: author ? { email: author.email, displayName: author.displayName } : null,
			messages: await chatRepo.listMessagesByThread(share.threadId),
			artifacts: await chatRepo.listArtifactsByThread(share.threadId),
		});
	});

	return app;
}
