import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "@web/lib/api";
import { fmtCompact, fmtDate, fmtNum } from "@web/lib/utils";
import { Badge, TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";

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
		latencyMs: number | null;
		ttftMs: number | null;
		errorCode: string | null;
		meta: Record<string, unknown> | null;
	}[];
}

const STATUS_COLOR: Record<string, string> = {
	ok: "border-[#bcd9c0] text-[#1d7a33]",
	error: "border-[#e5bfc4] text-[#c6293b]",
	rate_limited: "border-[#e8d3a1] text-[#9a6b0a]",
	budget_exceeded: "border-[#e8d3a1] text-[#9a6b0a]",
};

export default function AdminLogs() {
	const { t } = useTranslation();
	const [status, setStatus] = useState("");
	const { data, isLoading, refetch, isFetching } = useQuery({
		queryKey: ["logs", status],
		queryFn: () => api<LogsResp>(`/api/admin/logs?limit=200${status ? `&status=${status}` : ""}`),
		refetchInterval: 15_000,
	});

	const total = (data?.logs ?? []).reduce((acc, l) => acc + l.promptTokens + l.completionTokens, 0);

	return (
		<div className="space-y-8">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("adminLogs.title")}</h1>
					<p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">{t("adminLogs.desc", { tokens: fmtNum(total), count: data?.logs.length ?? 0 })}</p>
				</div>
				<div className="flex items-center gap-2">
					<select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-sm border border-line bg-white px-3 font-mono text-[12px]">
						<option value="">{t("adminLogs.allStatus")}</option>
						<option value="ok">ok</option>
						<option value="error">error</option>
						<option value="rate_limited">rate_limited</option>
						<option value="budget_exceeded">budget_exceeded</option>
					</select>
					<button onClick={() => refetch()} className="label-mono text-accent hover:underline cursor-pointer">
						{isFetching ? t("common.loading").toLowerCase() : t("common.refresh")}
					</button>
				</div>
			</header>

			<div className="rounded-lg border border-line bg-white">
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
							<TH className="text-right">{t("adminLogs.colLatency")}</TH>
							<TH className="text-right">TTFT</TH>
						</TR>
					</THead>
					<TBody>
						{isLoading && (
							<TR>
								<TD colSpan={9} className="py-8 text-center text-sm text-ink-2">
									{t("common.loading")}
								</TD>
							</TR>
						)}
						{(data?.logs ?? []).map((l) => (
							<TR key={l.id}>
								<TD className="whitespace-nowrap font-mono text-[12px] text-ink-2">{fmtDate(l.ts)}</TD>
								<TD className="font-mono text-[12px]">{l.userEmail ?? "—"}</TD>
								<TD>
									<div className="font-mono text-[12px]">{l.model}</div>
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
								<TD className="text-right font-mono text-[12px] tabular-nums">{l.latencyMs != null ? `${(l.latencyMs / 1000).toFixed(1)}s` : "—"}</TD>
								<TD className="text-right font-mono text-[12px] tabular-nums">{l.ttftMs != null ? `${l.ttftMs}ms` : "—"}</TD>
							</TR>
						))}
						{!isLoading && (data?.logs.length ?? 0) === 0 && (
							<TR>
								<TD colSpan={9} className="py-10 text-center text-sm text-ink-2">
									{t("adminLogs.noLogs")}
								</TD>
							</TR>
						)}
					</TBody>
				</Table>
			</div>
		</div>
	);
}
