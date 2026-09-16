import { Activity, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fmtCompact } from "@web/lib/utils";

interface QuotaSummaryCardsProps {
	summary: {
		total5hTokens: number;
		totalWeekTokens: number;
		totalAccounts: number;
		activeCount: number;
		cooldownCount: number;
	};
}

export function QuotaSummaryCards({ summary }: QuotaSummaryCardsProps) {
	const { t } = useTranslation();

	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{/* 5-Hour Active Load */}
			<div className="rounded-lg border border-line bg-white p-4 shadow-xs">
				<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase tracking-wider">
					<span>{t("adminQuotas.fiveHourWindow")}</span>
					<Clock className="size-4 text-accent" />
				</div>
				<div className="mt-2 flex items-baseline gap-1.5 font-mono">
					<span className="text-2xl font-semibold text-ink">{fmtCompact(summary.total5hTokens)}</span>
					<span className="text-xs text-ink-2">tokens</span>
				</div>
				<p className="mt-1 text-[11px] text-ink-2 font-mono">{t("adminQuotas.rollingReset")}</p>
			</div>

			{/* Weekly Volume */}
			<div className="rounded-lg border border-line bg-white p-4 shadow-xs">
				<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase tracking-wider">
					<span>{t("adminQuotas.weeklyWindow")}</span>
					<Activity className="size-4 text-[#1d7a33]" />
				</div>
				<div className="mt-2 flex items-baseline gap-1.5 font-mono">
					<span className="text-2xl font-semibold text-ink">{fmtCompact(summary.totalWeekTokens)}</span>
					<span className="text-xs text-ink-2">tokens</span>
				</div>
				<p className="mt-1 text-[11px] text-ink-2 font-mono">Past 7 days volume</p>
			</div>

			{/* Active Connections */}
			<div className="rounded-lg border border-line bg-white p-4 shadow-xs">
				<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase tracking-wider">
					<span>{t("adminQuotas.activeAccounts")}</span>
					<CheckCircle2 className="size-4 text-[#1d7a33]" />
				</div>
				<div className="mt-2 flex items-baseline gap-1.5 font-mono">
					<span className="text-2xl font-semibold text-[#1d7a33]">{summary.activeCount}</span>
					<span className="text-xs text-ink-2">/ {summary.totalAccounts} total</span>
				</div>
				<p className="mt-1 text-[11px] text-ink-2 font-mono">Ready for routing</p>
			</div>

			{/* Cooldown Accounts */}
			<div className="rounded-lg border border-line bg-white p-4 shadow-xs">
				<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase tracking-wider">
					<span>{t("adminQuotas.cooldownAccounts")}</span>
					<AlertTriangle className={`size-4 ${summary.cooldownCount > 0 ? "text-[#c6293b]" : "text-ink-2"}`} />
				</div>
				<div className="mt-2 flex items-baseline gap-1.5 font-mono">
					<span className={`text-2xl font-semibold ${summary.cooldownCount > 0 ? "text-[#c6293b]" : "text-ink"}`}>
						{summary.cooldownCount}
					</span>
					<span className="text-xs text-ink-2">accounts</span>
				</div>
				<p className="mt-1 text-[11px] text-ink-2 font-mono">
					{summary.cooldownCount > 0 ? "Temporarily paused" : "All accounts healthy"}
				</p>
			</div>
		</div>
	);
}
