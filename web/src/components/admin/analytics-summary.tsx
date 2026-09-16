import { Activity, AlertCircle, Coins, Cpu, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fmtCompact } from "@web/lib/utils";

interface AnalyticsSummaryProps {
	totals: {
		totalTokens: number;
		promptTokens: number;
		completionTokens: number;
		cacheReadTokens: number;
		cacheWriteTokens: number;
		credits: number;
		requests: number;
		errors: number;
		errorRate: number;
		avgLatencyMs: number;
	};
}

export function AnalyticsSummary({ totals }: AnalyticsSummaryProps) {
	const { t } = useTranslation();

	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{/* Total Tokens Card */}
			<div className="rounded-lg border border-line bg-white p-4 shadow-xs">
				<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase tracking-wider">
					<span>{t("adminAnalytics.totalTokens")}</span>
					<Cpu className="size-4 text-accent" />
				</div>
				<div className="mt-2 flex items-baseline gap-1.5 font-mono">
					<span className="text-2xl font-semibold text-ink">{fmtCompact(totals.totalTokens)}</span>
					<span className="text-xs text-ink-2">tokens</span>
				</div>
				<p className="mt-1 text-[10.5px] text-ink-2 font-mono truncate">
					In: {fmtCompact(totals.promptTokens)} &middot; Out: {fmtCompact(totals.completionTokens)}
				</p>
			</div>

			{/* Credits Spent Card */}
			<div className="rounded-lg border border-line bg-white p-4 shadow-xs">
				<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase tracking-wider">
					<span>{t("adminAnalytics.totalCredits")}</span>
					<Coins className="size-4 text-[#b45309]" />
				</div>
				<div className="mt-2 flex items-baseline gap-1.5 font-mono">
					<span className="text-2xl font-semibold text-ink">{totals.credits.toFixed(2)}</span>
					<span className="text-xs text-ink-2">cr</span>
				</div>
				<p className="mt-1 text-[10.5px] text-ink-2 font-mono truncate">
					Cache read: {fmtCompact(totals.cacheReadTokens)}
				</p>
			</div>

			{/* Total Requests & Error Rate */}
			<div className="rounded-lg border border-line bg-white p-4 shadow-xs">
				<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase tracking-wider">
					<span>{t("adminAnalytics.totalRequests")}</span>
					<Activity className="size-4 text-[#1d7a33]" />
				</div>
				<div className="mt-2 flex items-baseline gap-1.5 font-mono">
					<span className="text-2xl font-semibold text-ink">{totals.requests.toLocaleString()}</span>
					<span className="text-xs text-ink-2">reqs</span>
				</div>
				<p className="mt-1 text-[10.5px] font-mono flex items-center gap-1">
					<span className={totals.errors > 0 ? "text-[#c6293b]" : "text-[#1d7a33]"}>
						{totals.errorRate}% error rate ({totals.errors} errs)
					</span>
				</p>
			</div>

			{/* Avg Response Latency */}
			<div className="rounded-lg border border-line bg-white p-4 shadow-xs">
				<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase tracking-wider">
					<span>{t("adminAnalytics.avgLatency")}</span>
					<Timer className="size-4 text-accent" />
				</div>
				<div className="mt-2 flex items-baseline gap-1.5 font-mono">
					<span className="text-2xl font-semibold text-ink">
						{totals.avgLatencyMs > 0 ? (totals.avgLatencyMs / 1000).toFixed(2) : "0.00"}
					</span>
					<span className="text-xs text-ink-2">sec</span>
				</div>
				<p className="mt-1 text-[10.5px] text-ink-2 font-mono">
					Average round-trip response time
				</p>
			</div>
		</div>
	);
}
