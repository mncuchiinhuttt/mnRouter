import { chatRepo } from "../repositories/chat.repository.js";
import { modelRepo } from "../repositories/model.repository.js";
import { openUpstreamWithFailover, translateUpstreamStream } from "../gateway/router.js";
import { ARTIFACT_TTL_MS } from "./chat.service.js";
import type { User } from "@db/schema";
import type { CanonicalRequest } from "../gateway/canonical.js";
import type { ProviderId } from "../gateway/registry.js";

export class CompactService {
	async compactThread(
		threadId: string,
		user: User
	): Promise<{
		success: boolean;
		summary: string;
		artifactId?: string;
		originalCount: number;
		savedTokens: number;
	}> {
		const messages = await chatRepo.listMessagesByThread(threadId);
		if (messages.length < 2) {
			throw new Error("thread_too_short_to_compact");
		}

		// 1. Build text representation of conversation
		const transcript = messages
			.map((m) => `[${m.role.toUpperCase()}]:\n${m.content}`)
			.join("\n\n---\n\n");

		// 2. Claude-style compaction prompt
		const prompt = `You are an expert Context Compactor following the Anthropic / Claude Code working memory architecture.
Your task is to compress the conversation history below into an exceptionally dense, high-fidelity engineering "Working Memory" document.
Preserve 100% of crucial facts, technical constraints, user preferences, architectural decisions, file changes, and pending tasks.
Omit conversational pleasantries, repetitive iterations, and transient tool error traces.

Format the output strictly as clean Markdown with these exact 5 sections:

# Working Memory & Context Snapshot

## 1. Primary Goals & Intent
- [Concise bullet points of the user's objective and scope]

## 2. Key Architectural Decisions & Rationale
- [Technical choices made, packages/frameworks selected, constraints obeyed]

## 3. Implementation & System State
- [Files modified/created, database schemas, active endpoints, key functions]

## 4. Pending Tasks & Unresolved Questions
- [What is in progress, next immediate steps, any unanswered questions]

## 5. Critical Working Details
- [Exact variable names, ports, test commands, or critical context needed for future turns]

---
CONVERSATION TO COMPACT:
${transcript.slice(-60000)}`;

		// 3. Resolve model to synthesize compaction (prefer fast model)
		let compactModel = await modelRepo.findEnabledById("gemini-3.8-flash");
		if (!compactModel) {
			compactModel = await modelRepo.findEnabledById("muse-spark-1.3-contributor-free");
		}

		let summary = "";
		if (compactModel) {
			const canonReq: CanonicalRequest = {
				model: compactModel.id,
				upstreamModel: compactModel.upstreamModel,
				messages: [
					{
						role: "user",
						content: [{ type: "text", text: prompt }],
					},
				],
				system: "You are an expert AI context compactor. Output high-density, accurate Markdown only.",
				stream: true,
			};

			try {
				const upstream = await openUpstreamWithFailover(compactModel.provider as ProviderId, canonReq);
				for await (const ev of translateUpstreamStream(upstream.attempt.res.body!, upstream.attempt.parser, compactModel.provider as ProviderId)) {
					if (ev.type === "text_delta") {
						summary += ev.delta;
					}
				}
			} catch (err) {
				console.warn("[compact] upstream failed, using fallback summary", err);
			}
		}

		// Fallback: create a structured digest if upstream call fails
		if (!summary.trim()) {
			summary = `# Working Memory & Context Snapshot\n\n## 1. Primary Goals & Intent\n- Thread context consolidated.\n\n## 2. Recent Messages Summary\n${messages
				.slice(-6)
				.map((m) => `- **${m.role}**: ${m.content.slice(0, 200).replace(/\n/g, " ")}...`)
				.join("\n")}`;
		}

		// 4. Save compact summary message in thread
		const compactMsg = await chatRepo.createMessage({
			threadId,
			role: "system",
			content: `📦 **Ngữ cảnh đã được thu gọn (Working Memory Snapshot)**\n\n${summary}`,
			meta: {
				isCompact: true,
				originalCount: messages.length,
				compactedAt: new Date().toISOString(),
				tokens: Math.ceil(summary.length / 3.8),
			},
		});

		// 5. Save working-memory.md artifact
		const expiresAt = new Date(Date.now() + ARTIFACT_TTL_MS);
		const artifact = await chatRepo.createArtifact({
			messageId: compactMsg.id,
			threadId,
			identifier: "working-memory",
			type: "markdown",
			title: "working-memory.md",
			content: summary,
			language: "markdown",
			expiresAt,
		});

		// 6. Prune older intermediate messages (keep first user goal message + new compact message)
		const firstMessage = messages[0];
		const keepIds = [compactMsg.id];
		if (firstMessage) keepIds.push(firstMessage.id);
		await chatRepo.deleteMessagesByThread(threadId, keepIds);

		const originalEst = Math.ceil(transcript.length / 3.8);
		const newEst = Math.ceil(summary.length / 3.8);

		return {
			success: true,
			summary,
			artifactId: artifact.id,
			originalCount: messages.length,
			savedTokens: Math.max(0, originalEst - newEst),
		};
	}
}

export const compactService = new CompactService();
