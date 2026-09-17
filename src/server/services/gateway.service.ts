import { authService } from "./auth.service.js";
import { budgetService } from "./budget.service.js";
import { modelService } from "./model.service.js";
import { modelRepo } from "../repositories/model.repository.js";
import { recordUsage, computeCredits } from "../usage/index.js";
import { openUpstreamWithFailover, translateUpstreamStream } from "../gateway/router.js";
import { aggregateEvents } from "../gateway/ingress/shared.js";
import { parseOpenAiChat, OpenAiChatFormatter } from "../gateway/ingress/openai-chat.js";
import { parseAnthropic, AnthropicFormatter } from "../gateway/ingress/anthropic.js";
import { parseOpenAiResponses, OpenAiResponsesFormatter } from "../gateway/ingress/openai-responses.js";
import { UpstreamError, emptyUsage, type CanonicalRequest, type CanonicalUsage, type StreamEvent } from "../gateway/canonical.js";

export type IngressKind = "openai-chat" | "anthropic" | "openai-responses";

const encoder = new TextEncoder();

function estimateUsage(canonical: CanonicalRequest, completionChars: number): CanonicalUsage {
	const promptChars = canonical.messages.reduce((acc, m) => acc + JSON.stringify(m.content).length, 0) + (canonical.system?.length ?? 0);
	return { promptTokens: Math.ceil(promptChars / 4), completionTokens: Math.ceil(completionChars / 4), cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };
}

function usageIsEmpty(u: CanonicalUsage): boolean {
	return u.promptTokens === 0 && u.completionTokens === 0;
}

export function openAiError(status: number, message: string, code: string) {
	return Response.json({ error: { message, type: status >= 500 ? "server_error" : "invalid_request_error", code } }, { status });
}

export function anthropicError(status: number, message: string, type = "api_error") {
	return Response.json({ type: "error", error: { type, message } }, { status });
}

export function errorResponse(kind: IngressKind, status: number, message: string, code: string) {
	return kind === "anthropic" ? anthropicError(status, message, code) : openAiError(status, message, code);
}

export class GatewayService {
	async handleRequest(c: { req: { raw: Request; text(): Promise<string> } }, kind: IngressKind): Promise<Response> {
		const startedAt = Date.now();
		const req = c.req.raw;

		const auth = await authService.authenticateApiKey(req.headers.get("authorization") ?? undefined);
		if (!auth) return errorResponse(kind, 401, "Invalid API key", "invalid_api_key");

		const body = (await c.req.text()) || "{}";
		let parsedBody: Record<string, any>;
		try {
			parsedBody = JSON.parse(body) as Record<string, any>;
		} catch {
			return errorResponse(kind, 400, "Invalid JSON body", "invalid_json");
		}

		const rl = await budgetService.checkRateLimit(auth.apiKey.id);
		if (!rl.allowed) {
			recordUsage({ userId: auth.user.id, apiKeyId: auth.apiKey.id, provider: "none", connectionId: null, model: String(parsedBody.model ?? "unknown"), endpoint: kind, status: "rate_limited", httpStatus: 429, errorCode: "rate_limited" });
			const payload = kind === "anthropic" ? { type: "error", error: { type: "rate_limit_error", message: `Rate limit exceeded. Retry after ${rl.retryAfter}s` } } : { error: { message: `Rate limit exceeded. Retry after ${rl.retryAfter}s`, type: "rate_limit_error", code: "rate_limited" } };
			return new Response(JSON.stringify(payload), { status: 429, headers: { "content-type": "application/json", "retry-after": String(rl.retryAfter) } });
		}

		const budget = await budgetService.checkBudget(auth.user);
		if (!budget.allowed) {
			recordUsage({ userId: auth.user.id, apiKeyId: auth.apiKey.id, provider: "none", connectionId: null, model: String(parsedBody.model ?? "unknown"), endpoint: kind, status: "budget_exceeded", httpStatus: 429, errorCode: "budget_exceeded", meta: { reason: budget.reason, usedCredits: budget.usedCredits, creditBudget: budget.creditBudget } });
			return errorResponse(kind, 429, `Weekly credit budget exceeded (${budget.usedCredits}/${budget.creditBudget} cr). Contact your admin.`, "budget_exceeded");
		}

		const resolved = await modelService.resolveModel(parsedBody.model);
		if (!resolved) return errorResponse(kind, 404, `Model '${parsedBody.model}' not found or disabled`, "model_not_found");

		if (!auth.user.allModels) {
			const allowedIds = new Set(await modelRepo.getUserModelIds(auth.user.id));
			if (!allowedIds.has(resolved.id)) {
				recordUsage({ userId: auth.user.id, apiKeyId: auth.apiKey.id, provider: resolved.provider, connectionId: null, model: resolved.id, endpoint: kind, status: "forbidden", httpStatus: 403, errorCode: "model_forbidden" });
				return errorResponse(kind, 403, `Model '${resolved.id}' is not enabled for this account`, "model_forbidden");
			}
		}

		let canonical: CanonicalRequest;
		const formatter = kind === "anthropic" ? new AnthropicFormatter(resolved.id) : kind === "openai-responses" ? new OpenAiResponsesFormatter(resolved.id) : new OpenAiChatFormatter(resolved.id);
		try {
			if (kind === "anthropic") canonical = parseAnthropic(parsedBody, resolved.upstreamModel);
			else if (kind === "openai-responses") canonical = parseOpenAiResponses(parsedBody, resolved.upstreamModel);
			else canonical = parseOpenAiChat(parsedBody, resolved.upstreamModel);
		} catch (err) {
			if (err instanceof UpstreamError) return errorResponse(kind, err.httpStatus, err.message, err.errorCode);
			return errorResponse(kind, 400, (err as Error).message, "invalid_request");
		}
		canonical.stream = parsedBody.stream === true;

		let upstream: { attempt: any; connectionId: string; connectionLabel: string };
		try {
			upstream = await openUpstreamWithFailover(resolved.provider, canonical);
		} catch (err) {
			const status = err instanceof UpstreamError ? err.httpStatus : 502;
			const code = err instanceof UpstreamError ? err.errorCode : "upstream_error";
			recordUsage({ userId: auth.user.id, apiKeyId: auth.apiKey.id, provider: resolved.provider, connectionId: null, model: resolved.id, endpoint: kind, status: "error", httpStatus: status, errorCode: code, latencyMs: Date.now() - startedAt, meta: { message: (err as Error).message.slice(0, 300) } });
			return errorResponse(kind, status, (err as Error).message, code);
		}

		if (canonical.stream) return this.handleStream(upstream, formatter, auth, resolved, kind, startedAt, canonical);
		return this.handleNonStream(upstream, formatter, auth, resolved, kind, startedAt, canonical);
	}

	private handleStream(upstream: any, formatter: any, auth: any, resolved: any, kind: IngressKind, startedAt: number, canonical: CanonicalRequest) {
		const ttftTracker = { value: undefined as number | undefined };
		const usageBox = { usage: emptyUsage() };

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
				recordUsage({
					userId: auth.user.id, apiKeyId: auth.apiKey.id, provider: resolved.provider, connectionId: upstream.connectionId, model: resolved.id,
					endpoint: kind, status: hadError ? "error" : "ok", usage: finalUsage, credits: computeCredits(resolved.priceIn, resolved.priceOut, finalUsage, resolved.priceCacheRead, resolved.priceCacheWrite),
					latencyMs: Date.now() - startedAt, ttftMs: ttftTracker.value, errorCode: hadError ? "stream_error" : undefined, meta: { connection: upstream.connectionLabel, streaming: true, estimated },
				});
			},
		});

		const daysToMon = ((1 - new Date().getDay() + 7) % 7) || 7;
		const resetMonSec = Math.floor((new Date().setHours(0, 0, 0, 0) + daysToMon * 24 * 3600 * 1000) / 1000);
		const reset5hSec = Math.floor(Date.now() / 1000) + 18000;
		const creditBudget = auth?.user?.monthlyCreditBudget ?? 50_000;

		const rateHeaders: Record<string, string> = {
			"content-type": kind === "anthropic" ? "text/event-stream" : "text/event-stream; charset=utf-8",
			"cache-control": "no-cache",
			connection: "keep-alive",
			"x-ratelimit-limit-requests": "10000",
			"x-ratelimit-remaining-requests": "9999",
			"x-ratelimit-reset-requests": "1s",
			"x-ratelimit-limit-tokens": "10000000",
			"x-ratelimit-remaining-tokens": "9999000",
			"x-ratelimit-reset-tokens": "1s",
			"x-codex-primary-used-percent": "0.0",
			"x-codex-primary-window-minutes": "300",
			"x-codex-primary-reset-at": String(reset5hSec),
			"x-codex-secondary-used-percent": "0.0",
			"x-codex-secondary-window-minutes": "10080",
			"x-codex-secondary-reset-at": String(resetMonSec),
			"x-codex-limit-name": "mnRouter AI Credits",
			"x-codex-credits-has-credits": "true",
			"x-codex-credits-unlimited": "false",
			"x-codex-credits-balance": String(creditBudget),
			"x-codex-active-limit": "5h",
			"anthropic-ratelimit-unified-status": "allowed",
			"anthropic-ratelimit-unified-reset": String(reset5hSec),
			"anthropic-ratelimit-unified-5h-utilization": "0.0",
			"anthropic-ratelimit-unified-5h-reset": String(reset5hSec),
			"anthropic-ratelimit-unified-5h-surpassed-threshold": "false",
			"anthropic-ratelimit-unified-7d-utilization": "0.0",
			"anthropic-ratelimit-unified-7d-reset": String(resetMonSec),
			"anthropic-ratelimit-unified-7d-surpassed-threshold": "false",
			"anthropic-ratelimit-unified-overage-status": "allowed",
			"anthropic-ratelimit-unified-overage-utilization": "0.0",
			"anthropic-ratelimit-unified-overage-reset": String(resetMonSec),
			"anthropic-ratelimit-requests-limit": "10000",
			"anthropic-ratelimit-requests-remaining": "9999",
			"anthropic-ratelimit-requests-reset": new Date(Date.now() + 1000).toISOString(),
			"anthropic-ratelimit-tokens-limit": "10000000",
			"anthropic-ratelimit-tokens-remaining": "9999000",
			"anthropic-ratelimit-tokens-reset": new Date(Date.now() + 1000).toISOString(),
		};
		return new Response(stream, { status: 200, headers: rateHeaders });
	}

	private async handleNonStream(upstream: any, formatter: any, auth: any, resolved: any, kind: IngressKind, startedAt: number, canonical: CanonicalRequest) {
		try {
			const events: StreamEvent[] = [];
			let completionChars = 0;
			const ttftTracker = { value: undefined as number | undefined };
			for await (const ev of translateUpstreamStream(upstream.attempt.res.body!, upstream.attempt.parser, resolved.provider)) {
				events.push(ev);
				if (ev.type === "start") ttftTracker.value ??= Date.now() - startedAt;
				if (ev.type === "text_delta") completionChars += ev.delta.length;
			}
			const { result, error } = aggregateEvents(events);
			if (!result) throw new UpstreamError(error?.message ?? "upstream error", 502, error?.code ?? "upstream_error", false);
			const finalUsage = usageIsEmpty(result.usage) ? estimateUsage(canonical, completionChars) : result.usage;
			result.usage = finalUsage;
			recordUsage({
				userId: auth.user.id, apiKeyId: auth.apiKey.id, provider: resolved.provider, connectionId: upstream.connectionId, model: resolved.id,
				endpoint: kind, status: "ok", usage: finalUsage, credits: computeCredits(resolved.priceIn, resolved.priceOut, finalUsage, resolved.priceCacheRead, resolved.priceCacheWrite),
				latencyMs: Date.now() - startedAt, ttftMs: ttftTracker.value, meta: { connection: upstream.connectionLabel, streaming: false },
			});
			const daysToMon = ((1 - new Date().getDay() + 7) % 7) || 7;
			const resetMonSec = Math.floor((new Date().setHours(0, 0, 0, 0) + daysToMon * 24 * 3600 * 1000) / 1000);
			const reset5hSec = Math.floor(Date.now() / 1000) + 18000;
			const creditBudget = auth?.user?.monthlyCreditBudget ?? 50_000;

			const nonStreamHeaders: Record<string, string> = {
				"content-type": "application/json",
				"x-ratelimit-limit-requests": "10000",
				"x-ratelimit-remaining-requests": "9999",
				"x-ratelimit-reset-requests": "1s",
				"x-ratelimit-limit-tokens": "10000000",
				"x-ratelimit-remaining-tokens": "9999000",
				"x-ratelimit-reset-tokens": "1s",
				"x-codex-primary-used-percent": "0.0",
				"x-codex-primary-window-minutes": "300",
				"x-codex-primary-reset-at": String(reset5hSec),
				"x-codex-secondary-used-percent": "0.0",
				"x-codex-secondary-window-minutes": "10080",
				"x-codex-secondary-reset-at": String(resetMonSec),
				"x-codex-limit-name": "mnRouter AI Credits",
				"x-codex-credits-has-credits": "true",
				"x-codex-credits-unlimited": "false",
				"x-codex-credits-balance": String(creditBudget),
				"x-codex-active-limit": "5h",
				"anthropic-ratelimit-unified-status": "allowed",
				"anthropic-ratelimit-unified-reset": String(reset5hSec),
				"anthropic-ratelimit-unified-5h-utilization": "0.0",
				"anthropic-ratelimit-unified-5h-reset": String(reset5hSec),
				"anthropic-ratelimit-unified-5h-surpassed-threshold": "false",
				"anthropic-ratelimit-unified-7d-utilization": "0.0",
				"anthropic-ratelimit-unified-7d-reset": String(resetMonSec),
				"anthropic-ratelimit-unified-7d-surpassed-threshold": "false",
				"anthropic-ratelimit-unified-overage-status": "allowed",
				"anthropic-ratelimit-unified-overage-utilization": "0.0",
				"anthropic-ratelimit-unified-overage-reset": String(resetMonSec),
				"anthropic-ratelimit-requests-limit": "10000",
				"anthropic-ratelimit-requests-remaining": "9999",
				"anthropic-ratelimit-requests-reset": new Date(Date.now() + 1000).toISOString(),
				"anthropic-ratelimit-tokens-limit": "10000000",
				"anthropic-ratelimit-tokens-remaining": "9999000",
				"anthropic-ratelimit-tokens-reset": new Date(Date.now() + 1000).toISOString(),
			};
			return new Response(JSON.stringify(formatter.formatNonStream(result, resolved.id)), { status: 200, headers: nonStreamHeaders });
		} catch (err) {
			const status = err instanceof UpstreamError ? err.httpStatus : 502;
			recordUsage({
				userId: auth.user.id, apiKeyId: auth.apiKey.id, provider: resolved.provider, connectionId: upstream.connectionId, model: resolved.id,
				endpoint: kind, status: "error", httpStatus: status, errorCode: "upstream_error", latencyMs: Date.now() - startedAt, meta: { message: (err as Error).message.slice(0, 300) },
			});
			return errorResponse(kind, status, (err as Error).message, "upstream_error");
		}
	}
}

export const gatewayService = new GatewayService();
