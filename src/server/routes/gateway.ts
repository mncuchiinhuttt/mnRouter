/**
 * Gateway routes: OpenAI-compatible + Anthropic-compatible endpoints.
 * Pipeline: auth key → rate limit → budget → parse ingress → resolve model →
 *           failover upstream → translate stream → log usage.
 */
import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { models as modelsTable } from "../db/schema.js";
import { authenticateApiKey } from "../auth/guards.js";
import { checkBudget, checkRateLimit } from "../limits/index.js";
import { recordUsage, computeCredits } from "../usage/index.js";
import type { CanonicalRequest, StreamEvent, CanonicalUsage } from "../gateway/canonical.js";
import { UpstreamError, emptyUsage } from "../gateway/canonical.js";
import type { ProviderId } from "../gateway/registry.js";
import { openUpstreamWithFailover, translateUpstreamStream } from "../gateway/router.js";
import { parseOpenAiChat, OpenAiChatFormatter } from "../gateway/ingress/openai-chat.js";
import { parseAnthropic, AnthropicFormatter } from "../gateway/ingress/anthropic.js";
import { parseOpenAiResponses, OpenAiResponsesFormatter } from "../gateway/ingress/openai-responses.js";
import { aggregateEvents } from "../gateway/ingress/shared.js";
import { sseChunk } from "../gateway/sse.js";

type IngressKind = "openai-chat" | "anthropic" | "openai-responses";

const encoder = new TextEncoder();

/** Kiro không trả token counts — ước lượng ~4 chars/token (đánh dấu trong meta). */
function estimateUsage(canonical: CanonicalRequest, completionChars: number): CanonicalUsage {
	const promptChars = canonical.messages.reduce((acc, m) => acc + JSON.stringify(m.content).length, 0) + (canonical.system?.length ?? 0);
	return {
		promptTokens: Math.ceil(promptChars / 4),
		completionTokens: Math.ceil(completionChars / 4),
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		reasoningTokens: 0,
	};
}

function usageIsEmpty(u: CanonicalUsage): boolean {
	return u.promptTokens === 0 && u.completionTokens === 0;
}

function openAiError(status: number, message: string, code: string) {
	return Response.json({ error: { message, type: status >= 500 ? "server_error" : "invalid_request_error", code } }, { status });
}

function anthropicError(status: number, message: string, type = "api_error") {
	return Response.json({ type: "error", error: { type, message } }, { status });
}

function errorResponse(kind: IngressKind, status: number, message: string, code: string) {
	if (kind === "anthropic") return anthropicError(status, message, code);
	return openAiError(status, message, code);
}

async function resolveModel(raw: string | undefined): Promise<{ id: string; provider: ProviderId; upstreamModel: string; priceIn: number; priceOut: number } | null> {
	if (!raw) return null;
	const id = raw.includes("/") ? raw.split("/").slice(1).join("/") : raw;
	const [row] = await db
		.select()
		.from(modelsTable)
		.where(and(eq(modelsTable.id, id), eq(modelsTable.enabled, true)));
	if (row) return { id: row.id, provider: row.provider as ProviderId, upstreamModel: row.upstreamModel, priceIn: row.priceIn, priceOut: row.priceOut };
	// fallback: model không có trong bảng → thử dùng chính nó làm upstream (admin tự thêm nếu muốn chặn)
	return null;
}

interface GatewayOptions {
	kind: IngressKind;
}

export function gatewayRoutes() {
	const app = new Hono();

	app.post("/v1/chat/completions", (c) => handleGateway(c, "openai-chat"));
	app.post("/v1/responses", (c) => handleGateway(c, "openai-responses"));
	app.post("/v1/messages", (c) => handleGateway(c, "anthropic"));
	app.post("/v1/messages/count_tokens", async (c) => {
		const body = await c.req.text().catch(() => "");
		return c.json({ input_tokens: Math.max(1, Math.ceil(body.length / 4)) });
	});

	app.get("/v1/models", async (c) => {
		const rows = await db.select().from(modelsTable).where(eq(modelsTable.enabled, true));
		return c.json({
			object: "list",
			data: rows.map((m) => ({
				id: m.id,
				object: "model",
				created: Math.floor(m.createdAt.getTime() / 1000),
				owned_by: m.provider,
				context_window: m.contextWindow,
				max_output_tokens: m.maxOutput,
			})),
		});
	});

	return app;
}

// Hono handlers need the context — use explicit routes above and a shared impl below.
async function handleGateway(c: { req: { raw: Request; text(): Promise<string> }; json(o: unknown, s?: number): Response }, kind: IngressKind): Promise<Response> {
	const startedAt = Date.now();
	const req = c.req.raw;

	// 1. API key auth
	const auth = await authenticateApiKey(req.headers.get("authorization") ?? undefined);
	if (!auth) return errorResponse(kind, 401, "Invalid API key", "invalid_api_key");

	const body = (await c.req.text()) || "{}";
	let parsedBody: Record<string, any>;
	try {
		parsedBody = JSON.parse(body) as Record<string, any>;
	} catch {
		return errorResponse(kind, 400, "Invalid JSON body", "invalid_json");
	}

	// 2. rate limit
	const rl = await checkRateLimit(auth.key.id);
	if (!rl.allowed) {
		recordUsage({
			userId: auth.user.id,
			apiKeyId: auth.key.id,
			provider: "none",
			connectionId: null,
			model: String(parsedBody.model ?? "unknown"),
			endpoint: kind,
			status: "rate_limited",
			httpStatus: 429,
			errorCode: "rate_limited",
		});
		const payload =
			kind === "anthropic"
				? { type: "error", error: { type: "rate_limit_error", message: `Rate limit exceeded. Retry after ${rl.retryAfter}s` } }
				: { error: { message: `Rate limit exceeded. Retry after ${rl.retryAfter}s`, type: "rate_limit_error", code: "rate_limited" } };
		return new Response(JSON.stringify(payload), {
			status: 429,
			headers: { "content-type": "application/json", "retry-after": String(rl.retryAfter) },
		});
	}

	// 3. budget (tokens & credits)
	const budget = await checkBudget(auth.user);
	if (!budget.allowed) {
		recordUsage({
			userId: auth.user.id,
			apiKeyId: auth.key.id,
			provider: "none",
			connectionId: null,
			model: String(parsedBody.model ?? "unknown"),
			endpoint: kind,
			status: "budget_exceeded",
			httpStatus: 429,
			errorCode: "budget_exceeded",
			meta: { reason: budget.reason, usedTokens: budget.usedTokens, tokenBudget: budget.tokenBudget, usedCredits: budget.usedCredits, creditBudget: budget.creditBudget },
		});
		const msg =
			budget.reason === "credits"
				? `Monthly credit budget exceeded (${budget.usedCredits}/${budget.creditBudget} cr). Contact your admin.`
				: `Monthly token budget exceeded (${budget.usedTokens}/${budget.tokenBudget}). Contact your admin.`;
		return errorResponse(kind, 429, msg, "budget_exceeded");
	}

	// 4. resolve model + parse ingress
	const resolved = await resolveModel(parsedBody.model);
	if (!resolved) {
		return errorResponse(kind, 404, `Model '${parsedBody.model}' not found or disabled`, "model_not_found");
	}

	let canonical: CanonicalRequest;
	const formatter =
		kind === "anthropic" ? new AnthropicFormatter(resolved.id) : kind === "openai-responses" ? new OpenAiResponsesFormatter(resolved.id) : new OpenAiChatFormatter(resolved.id);
	try {
		if (kind === "anthropic") canonical = parseAnthropic(parsedBody, resolved.upstreamModel);
		else if (kind === "openai-responses") canonical = parseOpenAiResponses(parsedBody, resolved.upstreamModel);
		else canonical = parseOpenAiChat(parsedBody, resolved.upstreamModel);
	} catch (err) {
		if (err instanceof UpstreamError) return errorResponse(kind, err.httpStatus, err.message, err.errorCode);
		return errorResponse(kind, 400, (err as Error).message, "invalid_request");
	}
	canonical.stream = parsedBody.stream === true;

	// 5. open upstream (failover happens here, before any client byte)
	let upstream: Awaited<ReturnType<typeof openUpstreamWithFailover>>;
	try {
		upstream = await openUpstreamWithFailover(resolved.provider, canonical);
	} catch (err) {
		const status = err instanceof UpstreamError ? err.httpStatus : 502;
		const code = err instanceof UpstreamError ? err.errorCode : "upstream_error";
		recordUsage({
			userId: auth.user.id,
			apiKeyId: auth.key.id,
			provider: resolved.provider,
			connectionId: null,
			model: resolved.id,
			endpoint: kind,
			status: "error",
			httpStatus: status,
			errorCode: code,
			latencyMs: Date.now() - startedAt,
			meta: { message: (err as Error).message.slice(0, 300) },
		});
		return errorResponse(kind, status, (err as Error).message, code);
	}

	const ttftTracker = { value: undefined as number | undefined };
	const usageBox: { usage: CanonicalUsage } = { usage: emptyUsage() };

	// 6. stream or aggregate
	if (canonical.stream) {
		const stream = new ReadableStream<Uint8Array>({
			async start(controller) {
				let hadError = false;
				let completionChars = 0;
				let estimated = false;
				try {
					for await (const rawEv of translateUpstreamStream(upstream.attempt.res.body!, upstream.attempt.parser, resolved.provider)) {
						let outgoing = rawEv;
						if (rawEv.type === "start") ttftTracker.value ??= Date.now() - startedAt;
						if (rawEv.type === "done") {
							let doneUsage = rawEv.usage;
							if (usageIsEmpty(doneUsage) && !hadError) {
								doneUsage = estimateUsage(canonical, completionChars);
								estimated = true;
							}
							usageBox.usage = doneUsage;
							outgoing = { ...rawEv, usage: doneUsage };
						}
						if (rawEv.type === "text_delta") completionChars += rawEv.delta.length;
						if (rawEv.type === "error") hadError = true;
						for (const chunk of formatter.format(outgoing)) controller.enqueue(encoder.encode(chunk));
					}
				} catch (err) {
					hadError = true;
					for (const chunk of formatter.format({ type: "error", errorCode: "stream_error", message: (err as Error).message, retryable: false })) {
						controller.enqueue(encoder.encode(chunk));
					}
				}
				controller.close();
				const finalUsage = estimated ? estimateUsage(canonical, completionChars) : usageBox.usage;
				if (estimated) usageBox.usage = finalUsage;
				recordUsage({
					userId: auth.user.id,
					apiKeyId: auth.key.id,
					provider: resolved.provider,
					connectionId: upstream.connectionId,
					model: resolved.id,
					endpoint: kind,
					status: hadError ? "error" : "ok",
					usage: finalUsage,
					credits: computeCredits(resolved.priceIn, resolved.priceOut, finalUsage),
					latencyMs: Date.now() - startedAt,
					ttftMs: ttftTracker.value,
					errorCode: hadError ? "stream_error" : undefined,
					meta: { connection: upstream.connectionLabel, streaming: true, estimated },
				});
			},
		});
		return new Response(stream, {
			status: 200,
			headers: {
				"content-type": kind === "anthropic" ? "text/event-stream" : "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	}

	// non-stream: collect events then aggregate
	try {
		const events: StreamEvent[] = [];
		let completionChars = 0;
		for await (const ev of translateUpstreamStream(upstream.attempt.res.body!, upstream.attempt.parser, resolved.provider)) {
			events.push(ev);
			if (ev.type === "start") ttftTracker.value ??= Date.now() - startedAt;
			if (ev.type === "done") usageBox.usage = ev.usage;
			if (ev.type === "text_delta") completionChars += ev.delta.length;
		}
		const { result, error } = aggregateEvents(events);
		if (!result) throw new UpstreamError(error?.message ?? "upstream error", 502, error?.code ?? "upstream_error", false);
		const finalUsage = usageIsEmpty(result.usage) ? estimateUsage(canonical, completionChars) : result.usage;
		result.usage = finalUsage;
		recordUsage({
			userId: auth.user.id,
			apiKeyId: auth.key.id,
			provider: resolved.provider,
			connectionId: upstream.connectionId,
			model: resolved.id,
			endpoint: kind,
			status: "ok",
			usage: finalUsage,
			credits: computeCredits(resolved.priceIn, resolved.priceOut, finalUsage),
			latencyMs: Date.now() - startedAt,
			ttftMs: ttftTracker.value,
			meta: { connection: upstream.connectionLabel, streaming: false },
		});
		return Response.json(formatter.formatNonStream(result, resolved.id));
	} catch (err) {
		const status = err instanceof UpstreamError ? err.httpStatus : 502;
		recordUsage({
			userId: auth.user.id,
			apiKeyId: auth.key.id,
			provider: resolved.provider,
			connectionId: upstream.connectionId,
			model: resolved.id,
			endpoint: kind,
			status: "error",
			httpStatus: status,
			errorCode: "upstream_error",
			latencyMs: Date.now() - startedAt,
			meta: { message: (err as Error).message.slice(0, 300) },
		});
		return errorResponse(kind, status, (err as Error).message, "upstream_error");
	}
}

/** Anthropic count_tokens — estimate (kh cần upstream). */
export function countTokensRoute() {
	return async (c: { req: { text(): Promise<string> } }) => {
		const body = await c.req.text();
		// ~4 chars/token heuristic
		const estimate = Math.max(1, Math.ceil(body.length / 4));
		return Response.json({ input_tokens: estimate });
	};
}

export { sseChunk };
