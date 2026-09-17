import { chatRepo } from "../repositories/chat.repository.js";
import { fileRepo } from "../repositories/file.repository.js";
import { fileService } from "./file.service.js";
import { modelService } from "./model.service.js";
import { budgetService } from "./budget.service.js";
import { modelRepo } from "../repositories/model.repository.js";
import { recordUsage, computeCredits } from "../usage/index.js";
import { openUpstreamWithFailover, translateUpstreamStream } from "../gateway/router.js";
import { extractArtifacts } from "../chat/artifacts.js";
import { extractTextFromFile } from "../chat/file-extractor.js";
import { HARNESS_SKILLS, THINKING_LEVELS, type ThinkingLevel } from "../../shared/skills.js";
import { customSkillRepo } from "../repositories/custom-skill.repository.js";
import { detectAutoSkills } from "../chat/skill-detector.js";
import { BASE_HARNESS_PROMPT } from "../chat/harness-prompt.js";
import { emptyUsage, type CanonicalMessage, type CanonicalRequest, type CanonicalUsage } from "../gateway/canonical.js";
import type { ChatThread, ChatMessage, ChatArtifact, User } from "@db/schema";

const encoder = new TextEncoder();
export const ARTIFACT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SYSTEM_PROMPT = BASE_HARNESS_PROMPT;
export class ChatService {
	async createThread(userId: string, model: string, title?: string): Promise<ChatThread> { return chatRepo.createThread({ userId, model, title }); }
	async getThread(id: string, userId: string): Promise<ChatThread | null> { return chatRepo.findThreadById(id, userId); }
	async listThreads(userId: string): Promise<ChatThread[]> { return chatRepo.listThreadsByUser(userId); }
	async updateThread(id: string, userId: string, data: { title?: string; model?: string }): Promise<ChatThread | null> {
		const thread = await chatRepo.findThreadById(id, userId);
		return thread ? chatRepo.updateThread(id, data) : null;
	}
	async deleteThread(id: string, userId: string): Promise<boolean> {
		try {
			await fileService.deleteFilesByThread(id, userId);
		} catch {}
		return chatRepo.deleteThread(id, userId);
	}

	async listMessages(threadId: string, userId: string): Promise<{ messages: ChatMessage[]; artifacts: ChatArtifact[] }> {
		const thread = await chatRepo.findThreadById(threadId, userId);
		if (!thread) throw new Error("thread_not_found");
		const messages = await chatRepo.listMessagesByThread(threadId);
		const artifacts = await chatRepo.listArtifactsByThread(threadId);
		return { messages, artifacts };
	}
	async streamMessage(params: {
		threadId: string; user: User; content: string; fileIds?: string[]; skillIds?: string[]; thinkingLevel?: ThinkingLevel; webSearch?: boolean;
	}): Promise<ReadableStream<Uint8Array>> {
		const { threadId, user, content, fileIds, skillIds, thinkingLevel, webSearch } = params;
		const thread = await chatRepo.findThreadById(threadId, user.id);
		if (!thread) throw new Error("thread_not_found");
		const targetModel = thread.model;
		const targetTitle = thread.title;
		const budget = await budgetService.checkBudget(user);
		if (!budget.allowed) {
			throw new Error(`credit_budget_exceeded: ${budget.reason}`);
		}

		const resolvedModel = await modelService.resolveModel(targetModel);
		if (!resolvedModel) throw new Error("model_not_found");
		const resolved = resolvedModel;
		if (!user.allModels) {
			const allowed = new Set(await modelRepo.getUserModelIds(user.id));
			if (!allowed.has(resolved.id)) throw new Error("model_forbidden");
		}

		// Read and attach file context if any
		let promptContent = content;
		const activeSkillsSet = new Set<string>(skillIds ?? []);
		let fileMetas: { id: string; filename: string; mimeType: string }[] = [];
		if (fileIds && fileIds.length > 0) {
			const files = await fileRepo.findByIds(fileIds);
			const snippets: string[] = [];
			fileMetas = files.filter((f) => f.userId === user.id);
			for (const f of fileMetas) {
				const readRes = await fileService.readFileBuffer(f.id, user.id);
				if (readRes) {
					const txt = await extractTextFromFile({ filename: f.filename, mimeType: f.mimeType, buffer: readRes.buffer });
					snippets.push(`### [Uploaded File: ${f.filename} (${f.mimeType})]\n${txt}`);
				}
			}
			if (snippets.length > 0) promptContent = `${snippets.join("\n\n")}\n\nUser request:\n${content}`;
		}

		for (const s of detectAutoSkills(content, fileMetas)) activeSkillsSet.add(s);
		// Save user message
		await chatRepo.createMessage({
			threadId,
			role: "user",
			content,
			fileIds: fileIds && fileIds.length > 0 ? fileIds : undefined,
		});

		// Auto-title thread if it's still default
		if (targetTitle === "New conversation") {
			const cleanTitle = content.trim().slice(0, 45).replace(/\n.*/g, "") || "Conversation";
			void chatRepo.updateThread(threadId, { title: cleanTitle });
		}

		// Build history for canonical request
		const history = await chatRepo.listMessagesByThread(threadId);
		const rawMsgs = history.filter((m) => m.role === "user" || m.role === "assistant"), canonicalMessages: CanonicalMessage[] = [];
		for (let i = 0; i < rawMsgs.length; i++) {
			const m = rawMsgs[i]!, text = i === rawMsgs.length - 1 && m.role === "user" ? promptContent : m.content, last = canonicalMessages[canonicalMessages.length - 1], fb = last?.content[0];
			if (last && last.role === m.role && fb && fb.type === "text") fb.text += `\n\n${text}`; else canonicalMessages.push({ role: m.role as "user" | "assistant", content: [{ type: "text", text }] });
		}
		const effectiveSkillIds = Array.from(activeSkillsSet);
		let system = SYSTEM_PROMPT;
		const builtIn = HARNESS_SKILLS.filter((s) => effectiveSkillIds.includes(s.id)), custom = await customSkillRepo.findActiveByIds(user.id, effectiveSkillIds);
		const all = [...builtIn.map((s) => `### [Skill: ${s.name}]\n${s.prompt}`), ...custom.map((s) => `### [Custom Skill: ${s.name}]\n${s.prompt}`)];
		if (all.length > 0) system += `\n\n## Activated Skills Instructions:\n` + all.join("\n\n");
		const thinkingOption = THINKING_LEVELS.find((t) => t.id === thinkingLevel);
		const shouldSearch = resolved.provider === "antigravity" || Boolean(webSearch);
		const canonical: CanonicalRequest = {
			model: resolved.id, upstreamModel: resolved.upstreamModel, messages: canonicalMessages, system, stream: true, webSearch: shouldSearch,
			reasoningEffort: thinkingLevel && thinkingLevel !== "off" ? thinkingLevel : undefined,
			thinking: thinkingOption && thinkingOption.budgetTokens > 0 ? { type: "enabled", budgetTokens: thinkingOption.budgetTokens } : undefined,
		};
		const startedAt = Date.now();
		const upstream = await openUpstreamWithFailover(resolved.provider, canonical);
		return new ReadableStream<Uint8Array>({
			async start(controller) {
				let accumulated = "", accumulatedThinking = "", searchEvents: { count: number; queries: string[]; sources: { title: string; uri: string; domain?: string }[] }[] = [];
				const steps: { id: string; type: "skill" | "search" | "thinking" | "exec"; label: string; labelVi?: string; status: "running" | "done" }[] = [];
				const emitStep = (s: { id: string; type: "skill" | "search" | "thinking" | "exec"; label: string; labelVi?: string; status: "running" | "done" }) => {
					const idx = steps.findIndex((x) => x.id === s.id);
					if (idx >= 0) steps[idx] = s; else steps.push(s);
					controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: s })}\n\n`));
				};
				if (effectiveSkillIds.length > 0) {
					const names = [...builtIn.map((s) => s.shortName), ...custom.map((s) => s.name)];
					emitStep({ id: "skills", type: "skill", label: `Activated Skills (${names.length}): ${names.join(", ")}`, labelVi: `Đã kích hoạt kỹ năng (${names.length}): ${names.join(", ")}`, status: "done" });
				}
				if (fileIds?.length) emitStep({ id: "files", type: "exec", label: `Loaded ${fileIds.length} attachment${fileIds.length > 1 ? "s" : ""}`, labelVi: `Đã nạp ${fileIds.length} tệp đính kèm`, status: "done" });
				const heartbeat = setInterval(() => { try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { clearInterval(heartbeat); } }, 12_000);
				let finalUsage: CanonicalUsage = emptyUsage();
				try {
					for await (const ev of translateUpstreamStream(upstream.attempt.res.body!, upstream.attempt.parser, resolved.provider)) {
						if (ev.type === "text_delta") {
							if (!accumulated && accumulatedThinking) emitStep({ id: "thinking", type: "thinking", label: "Completed reasoning process", labelVi: "Hoàn tất quá trình suy luận", status: "done" });
							accumulated += ev.delta; controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: ev.delta })}\n\n`));
						} else if (ev.type === "thinking_delta") {
							if (!accumulatedThinking) emitStep({ id: "thinking", type: "thinking", label: "Reasoning and analyzing logic...", labelVi: "Đang suy luận logic...", status: "running" });
							accumulatedThinking += ev.delta; controller.enqueue(encoder.encode(`data: ${JSON.stringify({ thinking: ev.delta })}\n\n`));
						} else if (ev.type === "grounding_delta") {
							const qStr = ev.queries.length > 0 ? ` "${ev.queries.slice(0, 2).join('", "')}"` : "";
							emitStep({ id: "search", type: "search", label: `Called Web Search tool${qStr} (${ev.count} sources)`, labelVi: `Đã gọi công cụ Tìm kiếm Web${qStr} (${ev.count} nguồn)`, status: "done" });
							searchEvents.push({ count: ev.count, queries: ev.queries, sources: ev.sources });
							controller.enqueue(encoder.encode(`data: ${JSON.stringify({ search: { count: ev.count, queries: ev.queries, sources: ev.sources } })}\n\n`));
						} else if (ev.type === "done") {
							emitStep({ id: "answer", type: "exec", label: "Response completed", labelVi: "Hoàn tất phản hồi", status: "done" });
							finalUsage = ev.usage;
						}
					}

					// Save assistant message
					const assistantMsg = await chatRepo.createMessage({
						threadId,
						role: "assistant",
						content: accumulated,
						meta: {
							thinking: accumulatedThinking || undefined,
							skills: skillIds && skillIds.length > 0 ? skillIds : undefined,
							fileIds: fileIds && fileIds.length > 0 ? fileIds : undefined,
							searches: searchEvents.length > 0 ? searchEvents : undefined,
							steps: steps.length > 0 ? steps : undefined,
							tokens: (finalUsage.promptTokens || 0) + (finalUsage.completionTokens || 0),
							latencyMs: Date.now() - startedAt,
						},
					});
					// Extract and save artifacts (TTL 24 hours)
					const extracted = extractArtifacts(accumulated);
					const savedArtifacts: ChatArtifact[] = [];
					const expiresAt = new Date(Date.now() + ARTIFACT_TTL_MS);

					for (const art of extracted) {
						const saved = await chatRepo.createArtifact({
							messageId: assistantMsg.id,
							threadId,
							identifier: art.identifier,
							type: art.type,
							title: art.title,
							content: art.content,
							language: art.language,
							expiresAt,
						});
						savedArtifacts.push(saved);
					}

					recordUsage({
						userId: user.id, apiKeyId: null, provider: resolved.provider, connectionId: upstream.connectionId, model: resolved.id, endpoint: "chat", status: "ok", httpStatus: 200, usage: finalUsage, credits: computeCredits(resolved.priceIn, resolved.priceOut, finalUsage), latencyMs: Date.now() - startedAt,
					});

					controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, messageId: assistantMsg.id, artifacts: savedArtifacts, latencyMs: Date.now() - startedAt })}\n\n`));
				} catch (err) {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: (err as Error).message })}\n\n`));
				} finally {
					clearInterval(heartbeat);
					controller.close();
				}
			},
		});
	}
}

export const chatService = new ChatService();
