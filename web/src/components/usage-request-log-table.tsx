import React from "react";
import { useTranslation } from "react-i18next";
import { fmtDate, fmtNum } from "@web/lib/utils";
import { Badge, TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";
import { Pagination } from "@web/components/ui/pagination";

export interface UsageLogItem {
	id: number;
	ts: string;
	provider: string;
	model: string;
	endpoint: string;
	status: string;
	promptTokens: number;
	completionTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	credits: string;
	latencyMs: number | null;
	errorCode: string | null;
}

export interface UsageRequestLogTableProps {
	logs: UsageLogItem[];
	isLoading: boolean;
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	onLimitChange: (limit: number) => void;
}

export function UsageRequestLogTable({
	logs,
	isLoading,
	page,
	limit,
	total,
	totalPages,
	onPageChange,
	onLimitChange,
}: UsageRequestLogTableProps) {
	const { t } = useTranslation();

	return (
		<div className="rounded-lg border border-line bg-white shadow-2xs overflow-hidden">
			<Table>
				<THead>
					<TR>
						<TH>{t("usage.colTime")}</TH>
						<TH>{t("usage.colEndpoint")}</TH>
						<TH>{t("usage.colModel")}</TH>
						<TH>{t("usage.colStatus")}</TH>
						<TH className="text-right">{t("usage.colInput")}</TH>
						<TH className="text-right">{t("usage.colCacheRead")}</TH>
						<TH className="text-right">{t("usage.colCacheWrite")}</TH>
						<TH className="text-right">{t("usage.colOutput")}</TH>
						<TH className="text-right">{t("usage.colCredits")}</TH>
						<TH className="text-right">{t("usage.colLatency")}</TH>
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
					{logs.map((log) => (
						<TR key={log.id} className="hover:bg-paper-2/40 transition">
							<TD className="whitespace-nowrap font-mono text-[11px] text-ink-2">{fmtDate(log.ts)}</TD>
							<TD className="font-mono text-[11px]">{log.endpoint}</TD>
							<TD>
								<div className="font-mono text-[12px] text-ink">{log.model}</div>
								<div className="label-mono text-[9px] text-ink-2">{log.provider}</div>
							</TD>
							<TD>
								<Badge className={log.status === "ok" ? "border-[#bcd9c0] text-[#1d7a33]" : "border-[#e5bfc4] text-[#c6293b]"}>
									{log.status.toUpperCase()}
								</Badge>
								{log.errorCode && <div className="font-mono text-[10px] text-[#c6293b]">{log.errorCode}</div>}
							</TD>
							<TD className="text-right font-mono text-[11px] tabular-nums">{fmtNum(log.promptTokens)}</TD>
							<TD className="text-right font-mono text-[11px] tabular-nums">{fmtNum(log.cacheReadTokens)}</TD>
							<TD className="text-right font-mono text-[11px] tabular-nums">{fmtNum(log.cacheWriteTokens)}</TD>
							<TD className="text-right font-mono text-[11px] tabular-nums">{fmtNum(log.completionTokens)}</TD>
							<TD className="text-right font-mono text-[11px] tabular-nums font-semibold">{Number(log.credits ?? 0).toFixed(4)}</TD>
							<TD className="text-right font-mono text-[11px] tabular-nums text-ink-2">{log.latencyMs == null ? "—" : `${log.latencyMs}ms`}</TD>
						</TR>
					))}
					{!isLoading && logs.length === 0 && (
						<TR>
							<TD colSpan={10} className="py-10 text-center text-sm text-ink-2 font-mono">
								{t("usage.noLogs")}
							</TD>
						</TR>
					)}
				</TBody>
			</Table>

			{/* Pagination Footer */}
			<div className="border-t border-line/60 bg-paper/30">
				<Pagination
					page={page}
					totalPages={totalPages}
					total={total}
					limit={limit}
					onPageChange={onPageChange}
					onLimitChange={onLimitChange}
					itemLabel={t("pagination.requests")}
				/>
			</div>
		</div>
	);
}
