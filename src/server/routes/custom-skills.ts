import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth/guards.js";
import { customSkillRepo } from "../repositories/custom-skill.repository.js";
import { HARNESS_SKILLS } from "../../shared/skills.js";

function parseMarkdownSkill(raw: string): { name: string; description: string; prompt: string; icon: string } {
	let name = "Custom Skill";
	let description = "User custom skill from Markdown";
	let icon = "Sparkles";
	let prompt = raw.trim();

	const frontmatterMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
	if (frontmatterMatch) {
		const yamlBlock = frontmatterMatch[1] || "";
		prompt = (frontmatterMatch[2] || "").trim();
		for (const line of yamlBlock.split("\n")) {
			const [k, ...rest] = line.split(":");
			if (!k || !rest.length) continue;
			const key = k.trim().toLowerCase();
			const val = rest.join(":").trim().replace(/^["']|["']$/g, "");
			if (key === "name" || key === "title") name = val;
			if (key === "description" || key === "desc") description = val;
			if (key === "icon") icon = val;
		}
	} else {
		const h1Match = raw.match(/^#\s+(.+)$/m);
		if (h1Match && h1Match[1]) name = h1Match[1].trim();
		const lines = raw.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
		if (lines.length > 0 && lines[0]) description = lines[0].trim().slice(0, 200);
	}

	return { name, description, prompt: prompt || raw.trim(), icon };
}

export function customSkillRoutes() {
	const app = new Hono();
	app.use("/api/skills/*", requireAuth());

	app.get("/api/skills", async (c) => {
		const user = c.get("user");
		const userSkills = await customSkillRepo.listByUser(user.id);
		return c.json({
			builtInSkills: HARNESS_SKILLS,
			customSkills: userSkills,
		});
	});

	app.post("/api/skills", async (c) => {
		const user = c.get("user");
		const body = await c.req.json().catch(() => ({}));
		const rawMarkdown = typeof body.rawMarkdown === "string" ? body.rawMarkdown.trim() : "";
		if (!rawMarkdown) return c.json({ error: "missing_markdown" }, 400);

		const parsed = parseMarkdownSkill(rawMarkdown);
		const customName = typeof body.name === "string" && body.name.trim() ? body.name.trim() : parsed.name;
		const customDesc = typeof body.description === "string" && body.description.trim() ? body.description.trim() : parsed.description;
		const slug = customName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "custom-skill";

		const skill = await customSkillRepo.create({
			userId: user.id,
			name: customName,
			slug,
			description: customDesc,
			prompt: parsed.prompt,
			rawMarkdown,
			icon: parsed.icon || "Sparkles",
			enabled: true,
		});

		return c.json({ skill }, 201);
	});

	app.patch("/api/skills/:id", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		const skill = await customSkillRepo.findById(id, user.id);
		if (!skill) return c.json({ error: "not_found" }, 404);

		const body = await c.req.json().catch(() => ({}));
		const updateData: Record<string, unknown> = {};
		if (typeof body.name === "string" && body.name.trim()) updateData.name = body.name.trim();
		if (typeof body.description === "string") updateData.description = body.description.trim();
		if (typeof body.prompt === "string" && body.prompt.trim()) updateData.prompt = body.prompt.trim();
		if (typeof body.enabled === "boolean") updateData.enabled = body.enabled;

		const updated = await customSkillRepo.update(id, user.id, updateData);
		return c.json({ skill: updated });
	});

	app.delete("/api/skills/:id", async (c) => {
		const user = c.get("user");
		const id = c.req.param("id");
		const ok = await customSkillRepo.delete(id, user.id);
		return ok ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
	});

	return app;
}
