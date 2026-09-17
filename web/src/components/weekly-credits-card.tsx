import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "@web/lib/api";

interface UsageResp {
	weeklyCreditBudget?: number | null;
	creditBudget?: number | null;
	usedCreditsThisWeek?: number;
	usedCreditsThisMonth?: number;
}

interface WeeklyCreditsCardProps {
	packageName?: string | null;
	role?: string;
}

export function WeeklyCreditsCard({ packageName, role }: WeeklyCreditsCardProps = {}) {
	const { t } = useTranslation();
	const { data } = useQuery({
		queryKey: ["usage", "sidebar"],
		queryFn: () => api<UsageResp>("/api/me/usage"),
		refetchInterval: 30_000,
	});

	const budget = data?.weeklyCreditBudget ?? data?.creditBudget ?? null;
	const used = Math.round(data?.usedCreditsThisWeek ?? data?.usedCreditsThisMonth ?? 0);
	const remaining = budget != null ? Math.max(0, budget - used) : null;
	const pct = budget != null && budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;

	return (
		<div className="mx-4 mb-2 rounded-md border border-[#26264a] bg-navy-2 p-3 text-white shadow-xs">
			<div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[#8f8fb8]">
				<span>{t("credits.weeklyCredits")}</span>
				{packageName ? (
					<span className="rounded bg-accent/20 border border-accent/40 px-1.5 py-0.5 text-[9.5px] font-semibold text-accent-bright truncate max-w-[110px]">
						{packageName}
					</span>
				) : role === "admin" ? (
					<span className="rounded bg-accent/20 border border-accent/40 px-1.5 py-0.5 text-[9.5px] font-semibold text-accent-bright">
						ADMIN
					</span>
				) : budget != null ? (
					<span className={remaining != null && remaining <= 0 ? "text-[#c6293b]" : "text-accent-bright"}>
						{pct >= 100 ? t("overview.budgetExceeded") : `${100 - pct}% left`}
					</span>
				) : null}
			</div>
			<div className="mt-1 flex items-baseline justify-between font-mono">
				<div className="text-base font-semibold tracking-tight text-white">
					{budget == null ? (
						<span>{t("credits.unlimited")}</span>
					) : (
						<span>
							{remaining} <span className="text-xs font-normal text-[#8f8fb8]">cr</span>
						</span>
					)}
				</div>
				{budget != null && (
					<span className="text-[10px] text-[#8f8fb8]">
						{used} / {budget} cr
					</span>
				)}
			</div>
			{budget != null && (
				<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#1b1b38]">
					<div
						className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-[#c6293b]" : "bg-accent"}`}
						style={{ width: `${pct}%` }}
					/>
				</div>
			)}
		</div>
	);
}
