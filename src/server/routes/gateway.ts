import { Hono } from "hono";
import { gatewayService } from "../services/gateway.service.js";
import { modelService } from "../services/model.service.js";
import { authService } from "../services/auth.service.js";

export function gatewayRoutes() {
	const app = new Hono();

	app.post("/v1/chat/completions", (c) => gatewayService.handleRequest(c, "openai-chat"));
	app.post("/v1/responses", (c) => gatewayService.handleRequest(c, "openai-responses"));
	app.post("/v1/messages", (c) => gatewayService.handleRequest(c, "anthropic"));
	app.post("/v1/messages/count_tokens", async (c) => {
		const body = await c.req.text().catch(() => "");
		return c.json({ input_tokens: Math.max(1, Math.ceil(body.length / 4)) });
	});

	app.get("/v1/models", async (c) => {
		const auth = await authService.authenticateApiKey(c.req.header("authorization") ?? undefined);
		const user = auth?.user ?? c.get("user");
		const rows = await modelService.listModelsForUser(user);

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

	const handleBillingUsage = async (c: any) => {
		const authHeader = c.req.header("authorization") || (c.req.header("x-api-key") ? `Bearer ${c.req.header("x-api-key")}` : undefined);
		const auth = await authService.authenticateApiKey(authHeader);
		const user = auth?.user ?? c.get("user");
		if (!user) return c.json({ error: "unauthorized" }, 401);

		const { usageRepo } = await import("../repositories/usage.repository.js");
		const now = Date.now();
		const usedCredits = await usageRepo.getWeeklyCredits(user.id);
		const usedTokens = await usageRepo.getMonthlyTokens(user.id);
		const creditBudget = user.monthlyCreditBudget ?? 50_000;
		const remainingCredits = Math.max(0, creditBudget - usedCredits);
		const daysToMon = ((1 - new Date().getDay() + 7) % 7) || 7;
		const nextMonMs = new Date().setHours(0, 0, 0, 0) + daysToMon * 24 * 3600 * 1000;

		const limits = [
			{
				id: "mnrouter-credits",
				label: "MNRouter AI Credits (Weekly)",
				scope: { provider: "mnrouter", shared: true },
				window: { id: "weekly", label: "Weekly", resetsAt: nextMonMs },
				amount: {
					used: Math.round(usedCredits * 100) / 100,
					limit: creditBudget,
					remaining: Math.round(remainingCredits * 100) / 100,
					usedFraction: creditBudget > 0 ? Math.min(1, usedCredits / creditBudget) : 0,
					remainingFraction: creditBudget > 0 ? Math.max(0, (creditBudget - usedCredits) / creditBudget) : 1,
					unit: "credits",
				},
				status: usedCredits >= creditBudget ? "exhausted" : usedCredits >= creditBudget * 0.8 ? "warning" : "ok",
			},
		];

		if (user.monthlyTokenBudget) {
			const tokBudget = user.monthlyTokenBudget;
			const nextMonthMs = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getTime();
			limits.push({
				id: "mnrouter-tokens",
				label: "MNRouter Token Budget (Monthly)",
				scope: { provider: "mnrouter", shared: true },
				window: { id: "monthly", label: "Monthly", resetsAt: nextMonthMs },
				amount: {
					used: usedTokens,
					limit: tokBudget,
					remaining: Math.max(0, tokBudget - usedTokens),
					usedFraction: Math.min(1, usedTokens / tokBudget),
					remainingFraction: Math.max(0, (tokBudget - usedTokens) / tokBudget),
					unit: "tokens",
				},
				status: usedTokens >= tokBudget ? "exhausted" : usedTokens >= tokBudget * 0.8 ? "warning" : "ok",
			});
		}

		return c.json({
			generatedAt: now,
			reports: [{ provider: "mnrouter", fetchedAt: now, limits }],
			object: "list",
			total_usage: Math.round(usedCredits * 100) / 100,
			total_granted: creditBudget,
			total_used: Math.round(usedCredits * 100) / 100,
			total_available: Math.round(remainingCredits * 100) / 100,
			total_credits: creditBudget,
			used_credits: Math.round(usedCredits * 100) / 100,
			remaining_credits: Math.round(remainingCredits * 100) / 100,
			hard_limit_usd: creditBudget / 100,
			soft_limit_usd: creditBudget / 100,
			system_hard_limit_usd: creditBudget / 100,
			quota: {
				total: creditBudget,
				used: Math.round(usedCredits * 100) / 100,
				remaining: Math.round(remainingCredits * 100) / 100,
				unit: "credits",
				resetsAt: nextMonMs,
			},
		});
	};

	app.get("/v1/usage", handleBillingUsage);
	app.get("/dashboard/billing/usage", handleBillingUsage);
	app.get("/v1/dashboard/billing/usage", handleBillingUsage);
	app.get("/dashboard/billing/subscription", handleBillingUsage);
	app.get("/v1/dashboard/billing/subscription", handleBillingUsage);
	app.get("/dashboard/billing/credit_grants", handleBillingUsage);
	app.get("/v1/dashboard/billing/credit_grants", handleBillingUsage);

	return app;
}
