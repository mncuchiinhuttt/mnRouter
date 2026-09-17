import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { fmtDate, fmtNum } from "@web/lib/utils";
import { Badge, TD, TH, THead, TR, Table } from "@web/components/ui/primitives";
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
	const [newlyAddedIds, setNewlyAddedIds] = useState<Set<number>>(new Set());
	const prevIdsRef = useRef<Set<number> | null>(null);

	useEffect(() => {
		if (!logs || logs.length === 0) return;
		const currentIds = new Set(logs.map((l) => l.id));

		if (prevIdsRef.current === null) {
			// First mount: don't flash existing rows
			prevIdsRef.current = currentIds;
			return;
		}

		const brandNewIds = new Set<number>();
		for (const id of currentIds) {
			if (!prevIdsRef.current.has(id)) {
				brandNewIds.add(id);
			}
		}

		prevIdsRef.current = currentIds;

		if (brandNewIds.size > 0) {
			setNewlyAddedIds((prev) => new Set([...prev, ...brandNewIds]));
			const timer = setTimeout(() => {
				setNewlyAddedIds((prev) => {
					const next = new Set(prev);
					for (const id of brandNewIds) next.delete(id);
					return next;
				});
			}, 3500);
			return () => clearTimeout(timer);
		}
	}, [logs]);

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
					<tbody className="[&_tr:last-child]:border-0">
						{isLoading && (
							<tr className="border-b border-line">
								<TD colSpan={10} className="py-8 text-center text-sm text-ink-2 font-mono">
									{t("common.loading")}
								</TD>
							</tr>
						)}
						{logs.map((log) => {
							const isNew = newlyAddedIds.has(log.id);
							return (
								<motion.tr
									key={log.id}
									layout="position"
									initial={isNew ? { opacity: 0, y: -20, scale: 0.98 } : false}
									animate={{
										opacity: 1,
										y: 0,
										scale: 1,
										backgroundColor: isNew
											? log.status === "ok"
												? ["rgba(29, 122, 51, 0.18)", "rgba(29, 122, 51, 0.08)", "rgba(255, 255, 255, 0)"]
												: ["rgba(198, 41, 59, 0.18)", "rgba(198, 41, 59, 0.08)", "rgba(255, 255, 255, 0)"]
											: "rgba(255, 255, 255, 0)",
									}}
									transition={{
										layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
										opacity: { duration: 0.4 },
										y: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
										backgroundColor: isNew ? { duration: 3.5, ease: "easeOut" } : { duration: 0.2 },
									}}
									className={`border-b border-line transition-colors hover:bg-paper-2/60 relative ${
										isNew
											? log.status === "ok"
												? "shadow-[inset_3px_0_0_#1d7a33,0_0_16px_rgba(29,122,51,0.14)]"
												: "shadow-[inset_3px_0_0_#c6293b,0_0_16px_rgba(198,41,59,0.14)]"
											: ""
									}`}
								>
									<TD className="whitespace-nowrap font-mono text-[11px] text-ink-2">
										<div className="flex items-center gap-1.5">
											{isNew && (
												<span className="relative flex size-2 shrink-0">
													<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
													<span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
												</span>
											)}
											<span>{fmtDate(log.ts)}</span>
										</div>
									</TD>
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
								</motion.tr>
							);
						})}
						{!isLoading && logs.length === 0 && (
							<tr className="border-b border-line">
								<TD colSpan={10} className="py-10 text-center text-sm text-ink-2 font-mono">
									{t("usage.noLogs")}
								</TD>
							</tr>
						)}
					</tbody>
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
