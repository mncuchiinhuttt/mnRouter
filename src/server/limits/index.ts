import { budgetService, type BudgetCheckResult } from "../services/budget.service.js";
import type { User } from "@db/schema";

export type BudgetCheck = BudgetCheckResult;

export async function checkRateLimit(apiKeyId: string) {
	return budgetService.checkRateLimit(apiKeyId);
}

export async function checkBudget(user: { id: string; weeklyCreditBudget?: number | null; monthlyCreditBudget?: number | null }) {
	return budgetService.checkBudget(user as User);
}
