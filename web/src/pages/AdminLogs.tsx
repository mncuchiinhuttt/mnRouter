import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { api } from "@web/lib/api";
import { fmtCompact, fmtDate, fmtNum } from "@web/lib/utils";
import { Badge, TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { Pagination } from "@web/components/ui/pagination";

interface LogsResp {
	logs: {
		id: number;
		ts: string;
		userEmail: string | null;
		provider: string;
		model: string;
		endpoint: string;
		status: string;
		httpStatus: number | null;
		promptTokens: number;
		completionTokens: number;
		cacheReadTokens: number;
		reasoningTokens: number;
		credits: string;
		latencyMs: number | null;
		ttftMs: number | null;
		errorCode: string | null;
		meta: Record<string, unknown> | null;
	}[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	totalCredits: number;
	totalTokens: number;
}

const STATUS_COLOR: Record<string, string> = {
	ok: "border-[#bcd9c0] text-[#1d7a33]",
	error: "border-[#e5bfc4] text-[#c6293b]",
	rate_limited: "border-[#e8d3a1] text-[#9a6b0a]",
	budget_exceeded: "border-[#e8d3a1] text-[#9a6b0a]",
};

export default function AdminLogs() {
	const { t } = useTranslation();
	const [page, setPage] = useState(1);
	const [limit, setLimit] = useState(100);
	const [status, setStatus] = useState("");
	const [refreshInterval, setRefreshInterval] = useState<number>(10_000);

	const { data, isLoading, refetch, isFetching } = useQuery({
		queryKey: ["logs", status, page, limit],
		queryFn: () => api<LogsResp>(`/api/admin/logs?page=${page}&limit=${limit}${status ? `&status=${status}` : ""}`),
		placeholderData: keepPreviousData,
		refetchInterval: refreshInterval > 0 ? refreshInterval : false,
	});

	const handleStatusChange = (value: string) => {
		setStatus(value === "all" ? "" : value);
		setPage(1);
	};

	return (
		<div className="space-y-8">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("adminLogs.title")}</h1>
					<p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">
						{t("adminLogs.desc", { tokens: fmtNum(data?.totalTokens ?? 0), count: fmtNum(data?.total ?? 0) })} · {t("credits.totalSpend")}:{" "}
						<b className="font-mono text-ink">{(data?.totalCredits ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cr</b>
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
					<div className="flex items-center gap-1.5 text-xs text-ink-2 font-mono">
						<span className="relative flex size-2">
							{refreshInterval > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />}
							<span className={`relative inline-flex size-2 rounded-full ${refreshInterval > 0 ? "bg-accent" : "bg-line-2"}`} />
						</span>
					</div>
					<Select value={String(refreshInterval)} onValueChange={(val) => setRefreshInterval(Number(val))}>
						<SelectTrigger className="w-[85px] h-8 text-xs font-mono" aria-label={t("autoRefresh.label")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="5000">{t("autoRefresh.s5")}</SelectItem>
							<SelectItem value="10000">{t("autoRefresh.s10")}</SelectItem>
							<SelectItem value="15000">{t("autoRefresh.s15")}</SelectItem>
							<SelectItem value="30000">{t("autoRefresh.s30")}</SelectItem>
							<SelectItem value="0">{t("autoRefresh.off")}</SelectItem>
						</SelectContent>
					</Select>
					<Select value={status || "all"} onValueChange={handleStatusChange}>
						<SelectTrigger className="w-[150px] h-8 text-xs font-mono" aria-label={t("adminLogs.allStatus")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">{t("adminLogs.allStatus")}</SelectItem>
							<SelectItem value="ok">ok</SelectItem>
							<SelectItem value="error">error</SelectItem>
							<SelectItem value="rate_limited">rate_limited</SelectItem>
							<SelectItem value="budget_exceeded">budget_exceeded</SelectItem>
						</SelectContent>
					</Select>
					<button
						type="button"
						onClick={() => refetch()}
						title={t("common.refresh")}
						className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-line bg-white hover:bg-paper font-mono text-xs text-ink cursor-pointer transition shadow-2xs"
					>
						<RefreshCw className={`size-3 text-ink-2 ${isFetching ? "animate-spin text-accent" : ""}`} />
						<span>{t("common.refresh")}</span>
					</button>
				</div>
			</header>

			<div className="rounded-lg border border-line bg-white shadow-2xs overflow-hidden">
				<Table>
					<THead>
						<TR>
							<TH>{t("adminLogs.colTime")}</TH>
							<TH>{t("adminLogs.colUser")}</TH>
							<TH>{t("adminLogs.colModel")}</TH>
							<TH>{t("adminLogs.colStatus")}</TH>
							<TH className="text-right">{t("adminLogs.colIn")}</TH>
							<TH className="text-right">{t("adminLogs.colOut")}</TH>
							<TH className="text-right">{t("adminLogs.colCache")}</TH>
							<TH className="text-right">{t("credits.credits")}</TH>
							<TH className="text-right">{t("adminLogs.colLatency")}</TH>
							<TH className="text-right">{t("adminLogs.ttft")}</TH>
						</TR>
					</THead>
					<TBody>
						{isLoading && (
							<TR>
								<TD colSpan={10} className="py-8 text-center text-sm text-ink-2 font-mono">
									{t("common.loading")}
								</TD>
							</TR>
						)}
						{(data?.logs ?? []).map((l) => (
							<TR key={l.id} className="hover:bg-paper-2/40 transition">
								<TD className="whitespace-nowrap font-mono text-[12px] text-ink-2">{fmtDate(l.ts)}</TD>
								<TD className="font-mono text-[12px] text-ink">{l.userEmail ?? "—"}</TD>
								<TD>
									<div className="font-mono text-[12px] text-ink">{l.model}</div>
									<div className="label-mono text-[9.5px] text-ink-2">
										{l.provider} · {l.endpoint}
									</div>
								</TD>
								<TD>
									<Badge className={STATUS_COLOR[l.status] ?? ""}>{l.status.toUpperCase()}</Badge>
									{l.errorCode && <div className="font-mono text-[10px] text-[#c6293b]">{l.errorCode}</div>}
								</TD>
								<TD className="text-right font-mono text-[12px] tabular-nums">{fmtCompact(l.promptTokens)}</TD>
								<TD className="text-right font-mono text-[12px] tabular-nums">{fmtCompact(l.completionTokens)}</TD>
								<TD className="text-right font-mono text-[12px] tabular-nums">{fmtCompact(l.cacheReadTokens)}</TD>
								<TD className="text-right font-mono text-[12px] tabular-nums font-semibold">
									{Number(l.credits ?? 0) > 0 ? Number(l.credits).toFixed(2) : "—"}
								</TD>
								<TD className="text-right font-mono text-[12px] tabular-nums text-ink-2">
									{l.latencyMs != null ? `${(l.latencyMs / 1000).toFixed(1)}s` : "—"}
								</TD>
								<TD className="text-right font-mono text-[12px] tabular-nums text-ink-2">{l.ttftMs != null ? `${l.ttftMs}ms` : "—"}</TD>
							</TR>
						))}
						{!isLoading && (data?.logs.length ?? 0) === 0 && (
							<TR>
								<TD colSpan={10} className="py-10 text-center text-sm text-ink-2 font-mono">
									{t("adminLogs.noLogs")}
								</TD>
							</TR>
						)}
					</TBody>
				</Table>

				{/* Pagination Footer */}
				<div className="border-t border-line/60 bg-paper/30">
					<Pagination
						page={page}
						totalPages={data?.totalPages ?? 1}
						total={data?.total ?? 0}
						limit={limit}
						onPageChange={setPage}
						onLimitChange={(newLimit) => {
							setLimit(newLimit);
							setPage(1);
						}}
						itemLabel={t("pagination.requests")}
					/>
				</div>
			</div>
		</div>
	);
}
