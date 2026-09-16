import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, RefreshCw } from "lucide-react";
import { api } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { fmtCompact } from "@web/lib/utils";
import { AnalyticsSummary } from "@web/components/admin/analytics-summary";
import { AnalyticsBreakdown } from "@web/components/admin/analytics-breakdown";

interface AnalyticsResp {
	range: string;
	totals: {
		totalTokens: number;
		promptTokens: number;
		completionTokens: number;
		cacheReadTokens: number;
		cacheWriteTokens: number;
		reasoningTokens: number;
		credits: number;
		requests: number;
		errors: number;
		errorRate: number;
		avgLatencyMs: number;
	};
	byProvider: Array<{
		provider: string;
		tokens: number;
		credits: number;
		requests: number;
		errors: number;
		percent: number;
	}>;
	byModel: Array<{
		model: string;
		provider: string;
		tokens: number;
		credits: number;
		requests: number;
	}>;
	timeline: Array<{
		time: string;
		tokens: number;
		requests: number;
		credits: number;
	}>;
	leaderboard: Array<{
		rank: number;
		userId: string;
		email: string;
		displayName: string | null;
		packageName: string | null;
		role: string;
		totalTokens: number;
		promptTokens: number;
		completionTokens: number;
		credits: number;
		requests: number;
		errors: number;
		lastActive: string | null;
	}>;
}

const RANGES = [
	{ id: "24h", label: "24h" },
	{ id: "7d", label: "7 Days" },
	{ id: "30d", label: "30 Days" },
	{ id: "all", label: "All Time" },
] as const;

export default function AdminAnalytics() {
	const { t } = useTranslation();
	const [range, setRange] = useState<"24h" | "7d" | "30d" | "all">("7d");

	const { data, isLoading, refetch, isFetching } = useQuery({
		queryKey: ["admin-analytics", range],
		queryFn: () => api<AnalyticsResp>(`/api/admin/analytics?range=${range}`),
		refetchInterval: 30_000,
	});

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("adminAnalytics.title")}</h1>
					<p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">{t("adminAnalytics.desc")}</p>
				</div>

				<div className="flex items-center gap-2">
					{/* Time Range Pills */}
					<div className="inline-flex rounded-md border border-line bg-paper-2 p-0.5 font-mono text-xs shadow-2xs">
						{RANGES.map((r) => (
							<button
								key={r.id}
								type="button"
								onClick={() => setRange(r.id)}
								className={`rounded px-2.5 py-1 transition cursor-pointer ${
									range === r.id ? "bg-accent text-white font-medium" : "text-ink-2 hover:text-ink"
								}`}
							>
								{r.label}
							</button>
						))}
					</div>

					<Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching} className="h-8 gap-1.5 font-mono text-xs shrink-0">
						<RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
						<span>{t("common.refresh")}</span>
					</Button>
				</div>
			</header>

			{/* 1. Overall Metrics Summary */}
			{data?.totals ? (
				<AnalyticsSummary totals={data.totals} />
			) : (
				<div className="rounded-lg border border-line bg-white p-8 text-center text-xs font-mono text-ink-2">
					{isLoading ? t("common.loading") : "No analytics data"}
				</div>
			)}

			{/* 2. Provider Distribution & Top Models */}
			{data && <AnalyticsBreakdown byProvider={data.byProvider} byModel={data.byModel} />}
			{/* 3. Daily Traffic Timeline */}
			{data?.timeline && data.timeline.length > 0 && (
				<div className="rounded-lg border border-line bg-white p-4 shadow-xs space-y-3 font-mono text-xs">
					<div className="flex items-center justify-between border-b border-line pb-2.5">
						<span className="font-semibold text-ink text-sm">Daily Activity Timeline</span>
						<span className="text-ink-2">{data.timeline.length} periods</span>
					</div>
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
						{data.timeline.slice(-8).map((pt) => (
							<div key={pt.time} className="rounded-md border border-line/60 bg-paper-2/60 p-2.5 space-y-1">
								<div className="text-ink font-semibold">{pt.time}</div>
								<div className="text-accent text-[11px] font-medium">{fmtCompact(pt.tokens)} tokens</div>
								<div className="text-ink-2 text-[10.5px]">{pt.requests} requests &middot; {pt.credits.toFixed(2)} cr</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
