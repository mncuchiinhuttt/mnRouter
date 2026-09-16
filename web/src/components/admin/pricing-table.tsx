import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Input, TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";
import { SortHeader } from "./sort-header";
import type { AdminModelItem, SortOrder } from "./model-types";

type PriceSortKey = "id" | "provider" | "priceIn" | "priceCacheRead" | "priceCacheWrite" | "priceOut";

interface PricingTableProps {
	models: AdminModelItem[];
	isLoading: boolean;
	onPatch: (data: { id: string } & Record<string, unknown>) => void;
}

export function PricingTable({ models, isLoading, onPatch }: PricingTableProps) {
	const { t } = useTranslation();
	const [sortKey, setSortKey] = useState<PriceSortKey>("priceOut");
	const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

	const handleSort = (key: PriceSortKey) => {
		if (sortKey === key) {
			if (sortOrder === "asc") setSortOrder("desc");
			else if (sortOrder === "desc") {
				setSortKey("priceOut");
				setSortOrder("desc");
			}
		} else {
			setSortKey(key);
			setSortOrder("asc");
		}
	};

	const sortedModels = useMemo(() => {
		if (!sortOrder) return models;
		return [...models].sort((a, b) => {
			let res = 0;
			if (sortKey === "id") res = a.id.localeCompare(b.id);
			else if (sortKey === "provider") res = a.provider.localeCompare(b.provider);
			else if (sortKey === "priceIn") res = a.priceIn - b.priceIn;
			else if (sortKey === "priceCacheRead") res = a.priceCacheRead - b.priceCacheRead;
			else if (sortKey === "priceCacheWrite") res = a.priceCacheWrite - b.priceCacheWrite;
			else if (sortKey === "priceOut") res = a.priceOut - b.priceOut;
			return sortOrder === "asc" ? res : -res;
		});
	}, [models, sortKey, sortOrder]);

	return (
		<div className="space-y-3">
			<p className="max-w-3xl text-sm leading-relaxed text-ink-2">{t("credits.pricingDesc")}</p>
			<div className="rounded-lg border border-line bg-white shadow-xs">
				<Table>
					<THead>
						<TR>
							<TH>
								<SortHeader label={t("common.model")} columnKey="id" currentKey={sortKey} order={sortOrder} onSort={handleSort} />
							</TH>
							<TH>
								<SortHeader label={t("common.provider")} columnKey="provider" currentKey={sortKey} order={sortOrder} onSort={handleSort} />
							</TH>
							<TH className="text-right">
								<SortHeader label={t("credits.priceIn")} columnKey="priceIn" currentKey={sortKey} order={sortOrder} onSort={handleSort} align="right" />
							</TH>
							<TH className="text-right">
								<SortHeader label={t("credits.priceCacheRead")} columnKey="priceCacheRead" currentKey={sortKey} order={sortOrder} onSort={handleSort} align="right" />
							</TH>
							<TH className="text-right">
								<SortHeader label={t("credits.priceCacheWrite")} columnKey="priceCacheWrite" currentKey={sortKey} order={sortOrder} onSort={handleSort} align="right" />
							</TH>
							<TH className="text-right">
								<SortHeader label={t("credits.priceOut")} columnKey="priceOut" currentKey={sortKey} order={sortOrder} onSort={handleSort} align="right" />
							</TH>
						</TR>
					</THead>
					<TBody>
						{isLoading && (
							<TR>
								<TD colSpan={6} className="py-8 text-center text-sm text-ink-2">
									{t("common.loading")}
								</TD>
							</TR>
						)}
						{sortedModels.map((m) => (
							<TR key={m.id}>
								<TD className="font-mono text-[13px]">
									<span className="font-medium text-ink">{m.id}</span>
									<div className="text-[11px] text-ink-2">{m.displayName}</div>
								</TD>
								<TD>
									<Badge>{m.provider}</Badge>
								</TD>
								<TD className="text-right">
									<Input
										className="ml-auto h-7 w-20 px-2 text-right font-mono text-[12px]"
										defaultValue={m.priceIn}
										onBlur={(e) => {
											const v = Number(e.target.value.replace(/\D/g, ""));
											if (v !== m.priceIn) onPatch({ id: m.id, priceIn: v });
										}}
									/>
								</TD>
								<TD className="text-right">
									<Input
										className="ml-auto h-7 w-24 px-2 text-right font-mono text-[12px]"
										defaultValue={m.priceCacheRead || Math.round(m.priceIn * 0.1)}
										onBlur={(e) => {
											const v = Number(e.target.value.replace(/\D/g, ""));
											if (v !== m.priceCacheRead) onPatch({ id: m.id, priceCacheRead: v });
										}}
									/>
								</TD>
								<TD className="text-right">
									<Input
										className="ml-auto h-7 w-24 px-2 text-right font-mono text-[12px]"
										defaultValue={m.priceCacheWrite || Math.round(m.priceIn * 1.25)}
										onBlur={(e) => {
											const v = Number(e.target.value.replace(/\D/g, ""));
											if (v !== m.priceCacheWrite) onPatch({ id: m.id, priceCacheWrite: v });
										}}
									/>
								</TD>
								<TD className="text-right">
									<Input
										className="ml-auto h-7 w-20 px-2 text-right font-mono text-[12px]"
										defaultValue={m.priceOut}
										onBlur={(e) => {
											const v = Number(e.target.value.replace(/\D/g, ""));
											if (v !== m.priceOut) onPatch({ id: m.id, priceOut: v });
										}}
									/>
								</TD>
							</TR>
						))}
						{!isLoading && sortedModels.length === 0 && (
							<TR>
								<TD colSpan={6} className="py-10 text-center text-sm text-ink-2">
									{t("adminModels.noFilteredModels")}
								</TD>
							</TR>
						)}
					</TBody>
				</Table>
			</div>
			<p className="max-w-2xl text-xs text-ink-2">{t("credits.opencodeFreeNote")}</p>
		</div>
	);
}
