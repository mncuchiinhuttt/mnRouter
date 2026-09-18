import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { api } from "@web/lib/api";
import { fmtCompact, fmtNum } from "@web/lib/utils";
import { StatStrip, ModelBars } from "@web/components/usage-widgets";
import { CreditsTrendChart, ProviderDonutChart } from "@web/components/usage-charts";
import { ActivityHeatmap, type StreakData } from "@web/components/activity-heatmap";
import { EmptyChart } from "./Overview";
import { Tabs, TabsList, TabsTrigger } from "@web/components/ui/tabs-switch";
import { TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { UsageRequestLogTable, type UsageLogItem } from "@web/components/usage-request-log-table";

interface UsageResp {
	totals: { promptTokens: number; completionTokens: number; cacheRead: number; cacheWrite: number; requests: number; credits: number };
	daily: { date: string; prompt_tokens: string; completion_tokens: string; requests: string; credits: string }[];
	byModel: { model: string; provider: string; prompt_tokens: string; completion_tokens: string; requests: string; credits: string }[];
}

interface LogsResp {
	logs: UsageLogItem[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export default function UsagePage() {
	const { t } = useTranslation();
	const [page, setPage] = useState(1);
	const [limit, setLimit] = useState(100);
	const [refreshInterval, setRefreshInterval] = useState<number>(10_000);
	const [view, setView] = useState<"trend" | "bars" | "donut">("trend");

	const { data, isLoading, refetch: refetchUsage, isFetching: isFetchingUsage } = useQuery({
		queryKey: ["usage", "page"],
		queryFn: () => api<UsageResp>("/api/me/usage"),
		refetchInterval: refreshInterval > 0 ? refreshInterval : false,
	});

	const { data: logsData, isLoading: logsLoading, refetch: refetchLogs, isFetching: isFetchingLogs } = useQuery({
		queryKey: ["my-logs", page, limit],
		queryFn: () => api<LogsResp>(`/api/me/logs?page=${page}&limit=${limit}`),
		placeholderData: keepPreviousData,
		refetchInterval: refreshInterval > 0 ? refreshInterval : false,
	});
	const { data: streakData, isLoading: streakLoading } = useQuery({
		queryKey: ["my-streak"],
		queryFn: () => api<StreakData>("/api/me/streak"),
		refetchInterval: refreshInterval > 0 ? refreshInterval : false,
	});

	const isRefreshing = isFetchingUsage || isFetchingLogs;
	const handleRefreshAll = () => {
		refetchUsage();
		refetchLogs();
	};

	const trendData = (data?.daily ?? []).slice(0, 30).reverse().map((d) => ({
		date: d.date.slice(5),
		tokens: Number(d.prompt_tokens) + Number(d.completion_tokens),
		credits: Math.round(Number(d.credits ?? 0) * 100) / 100,
	}));
	const byModel = (data?.byModel ?? []).map((m) => ({ model: m.model, tokens: Number(m.prompt_tokens) + Number(m.completion_tokens) }));
	const byProvider = (data?.byModel ?? []).reduce<Record<string, { value: number; requests: number }>>((acc, m) => {
		const p = m.provider.toLowerCase();
		if (!acc[p]) acc[p] = { value: 0, requests: 0 };
		acc[p].value += Number(m.prompt_tokens) + Number(m.completion_tokens);
		acc[p].requests += Number(m.requests);
		return acc;
	}, {});
	const providerData = Object.entries(byProvider).map(([name, d]) => ({ name, value: d.value, requests: d.requests }));

	return (
		<div className="space-y-8">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("usage.title")}</h1>
				<div className="flex items-center gap-2.5">
					<div className="flex items-center gap-1.5 text-xs text-ink-2 font-mono">
						<span className="relative flex size-2">
							{refreshInterval > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />}
							<span className={`relative inline-flex size-2 rounded-full ${refreshInterval > 0 ? "bg-accent" : "bg-line-2"}`} />
						</span>
						<span>{t("autoRefresh.label")}:</span>
					</div>
					<Select value={String(refreshInterval)} onValueChange={(val) => setRefreshInterval(Number(val))}>
						<SelectTrigger className="w-[90px] h-8 text-xs font-mono" aria-label={t("autoRefresh.label")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="5000">{t("autoRefresh.s5")}</SelectItem>
							<SelectItem value="10000">{t("autoRefresh.s10")}</SelectItem>
							<SelectItem value="30000">{t("autoRefresh.s30")}</SelectItem>
							<SelectItem value="0">{t("autoRefresh.off")}</SelectItem>
						</SelectContent>
					</Select>
					<button
						type="button"
						onClick={handleRefreshAll}
						title={t("common.refresh")}
						className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-line bg-white hover:bg-paper font-mono text-xs text-ink cursor-pointer transition shadow-2xs"
					>
						<RefreshCw className={`size-3 text-ink-2 ${isRefreshing ? "animate-spin text-accent" : ""}`} />
						<span>{t("common.refresh")}</span>
					</button>
				</div>
			</header>

			<section>
				{isLoading ? (
					<div className="h-[96px] animate-pulse rounded-lg bg-paper-2" />
				) : (
					<StatStrip
						cells={[
							{ label: t("credits.totalCredits"), value: Number(data?.totals.credits ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), highlight: true },
							{ label: t("overview.totalTokens"), value: fmtCompact((data?.totals.promptTokens ?? 0) + (data?.totals.completionTokens ?? 0)) },
							{ label: t("usage.input"), value: fmtCompact(data?.totals.promptTokens ?? 0) },
							{ label: t("usage.output"), value: fmtCompact(data?.totals.completionTokens ?? 0) },
							{ label: t("usage.requests"), value: fmtNum(data?.totals.requests ?? 0) },
							{ label: t("adminModels.title"), value: String(data?.byModel.length ?? 0) },
						]}
					/>
				)}
			</section>

			{/* 365-Day Activity Heatmap & Streak */}
			<section>
				{streakLoading || !streakData ? (
					<div className="h-44 animate-pulse rounded-xl bg-paper-2" />
				) : (
					<ActivityHeatmap data={streakData} />
				)}
			</section>
			<section>
				<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
					<h2 className="text-2xl font-semibold tracking-tight">{t("usage.tokens30d")}</h2>
					<Tabs value={view} onValueChange={(value) => setView(value as "trend" | "bars" | "donut")}>
						<TabsList>
							<TabsTrigger value="trend">{t("usage.trendView")}</TabsTrigger>
							<TabsTrigger value="bars">{t("usage.byModel")}</TabsTrigger>
							<TabsTrigger value="donut">{t("usage.byProvider")}</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
				<div className="rounded-lg border border-line bg-white p-3 sm:p-4 shadow-2xs">
					{isLoading ? (
						<div className="h-[320px] animate-pulse rounded-md bg-paper-2" />
					) : trendData.length === 0 ? (
						<EmptyChart message={t("usage.noData")} />
					) : view === "trend" ? (
						<CreditsTrendChart data={trendData} />
					) : view === "bars" ? (
						byModel.length === 0 ? <EmptyChart message={t("usage.noData")} /> : <ModelBars data={byModel} />
					) : (
						providerData.length === 0 ? <EmptyChart message={t("usage.noData")} /> : <ProviderDonutChart data={providerData} />
					)}
				</div>
			</section>

			<section>
				<h2 className="mb-3 text-2xl font-semibold tracking-tight">{t("usage.byModelTable")}</h2>
				<div className="rounded-lg border border-line bg-white shadow-2xs overflow-hidden">
					<Table>
						<THead>
							<TR>
								<TH>{t("usage.byModelTable")}</TH>
								<TH>{t("common.provider")}</TH>
								<TH className="text-right">{t("usage.input")}</TH>
								<TH className="text-right">{t("usage.output")}</TH>
								<TH className="text-right">{t("usage.requests")}</TH>
								<TH className="text-right">{t("credits.credits")}</TH>
							</TR>
						</THead>
						<TBody>
							{(data?.byModel ?? []).map((model) => (
								<TR key={`${model.provider}/${model.model}`} className="hover:bg-paper-2/40 transition">
									<TD className="font-mono text-[13px]">{model.model}</TD>
									<TD><span className="label-mono">{model.provider}</span></TD>
									<TD className="text-right font-mono text-[13px] tabular-nums">{fmtNum(model.prompt_tokens)}</TD>
									<TD className="text-right font-mono text-[13px] tabular-nums">{fmtNum(model.completion_tokens)}</TD>
									<TD className="text-right font-mono text-[13px] tabular-nums">{fmtNum(model.requests)}</TD>
									<TD className="text-right font-mono text-[13px] tabular-nums font-semibold">{Number(model.credits ?? 0).toFixed(2)}</TD>
								</TR>
							))}
							{(data?.byModel?.length ?? 0) === 0 && <TR><TD colSpan={6} className="py-10 text-center text-sm text-ink-2 font-mono">{t("usage.noUsage")}</TD></TR>}
						</TBody>
					</Table>
				</div>
			</section>

			<section>
				<div className="mb-3">
					<h2 className="text-2xl font-semibold tracking-tight">{t("usage.requestLog")}</h2>
					<p className="mt-1 text-sm text-ink-2">{t("usage.requestLogDesc")}</p>
				</div>
				<UsageRequestLogTable
					logs={logsData?.logs ?? []}
					isLoading={logsLoading}
					page={page}
					limit={limit}
					total={logsData?.total ?? 0}
					totalPages={logsData?.totalPages ?? 1}
					onPageChange={setPage}
					onLimitChange={(newLimit) => {
						setLimit(newLimit);
						setPage(1);
					}}
				/>
			</section>
		</div>
	);
}
