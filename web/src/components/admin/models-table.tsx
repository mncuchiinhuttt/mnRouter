import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Input, TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";
import { Switch } from "@web/components/ui/tabs-switch";
import { SortHeader } from "./sort-header";
import type { AdminModelItem, SortOrder } from "./model-types";

type ModelSortKey = "id" | "provider" | "upstreamModel" | "contextWindow" | "price" | "enabled";

interface ModelsTableProps {
	models: AdminModelItem[];
	isLoading: boolean;
	onPatch: (data: { id: string } & Record<string, unknown>) => void;
}

export function ModelsTable({ models, isLoading, onPatch }: ModelsTableProps) {
	const { t } = useTranslation();
	const [sortKey, setSortKey] = useState<ModelSortKey>("id");
	const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

	const handleSort = (key: ModelSortKey) => {
		if (sortKey === key) {
			if (sortOrder === "asc") setSortOrder("desc");
			else if (sortOrder === "desc") {
				setSortKey("id");
				setSortOrder("asc");
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
			else if (sortKey === "upstreamModel") res = a.upstreamModel.localeCompare(b.upstreamModel);
			else if (sortKey === "contextWindow") res = a.contextWindow - b.contextWindow;
			else if (sortKey === "price") res = a.priceOut - b.priceOut || a.priceIn - b.priceIn;
			else if (sortKey === "enabled") res = (a.enabled === b.enabled ? 0 : a.enabled ? 1 : -1);
			return sortOrder === "asc" ? res : -res;
		});
	}, [models, sortKey, sortOrder]);

	return (
		<div className="rounded-lg border border-line bg-white shadow-xs">
			<Table>
				<THead>
					<TR>
						<TH>
							<SortHeader label={t("adminModels.colPublicId")} columnKey="id" currentKey={sortKey} order={sortOrder} onSort={handleSort} />
						</TH>
						<TH>
							<SortHeader label={t("common.provider")} columnKey="provider" currentKey={sortKey} order={sortOrder} onSort={handleSort} />
						</TH>
						<TH>
							<SortHeader label={t("adminModels.colUpstream")} columnKey="upstreamModel" currentKey={sortKey} order={sortOrder} onSort={handleSort} />
						</TH>
						<TH className="text-right">
							<SortHeader label={t("adminModels.colContext")} columnKey="contextWindow" currentKey={sortKey} order={sortOrder} onSort={handleSort} align="right" />
						</TH>
						<TH className="text-right">
							<SortHeader label={t("credits.colPrice")} columnKey="price" currentKey={sortKey} order={sortOrder} onSort={handleSort} align="right" />
						</TH>
						<TH>
							<SortHeader label={t("adminModels.colEnabled")} columnKey="enabled" currentKey={sortKey} order={sortOrder} onSort={handleSort} />
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
							<TD className="font-mono text-[13px] font-medium text-ink">{m.id}</TD>
							<TD>
								<Badge>{m.provider}</Badge>
							</TD>
							<TD>
								<Input
									className="h-7 w-56 px-2 font-mono text-[12px]"
									defaultValue={m.upstreamModel}
									onBlur={(e) => e.target.value !== m.upstreamModel && onPatch({ id: m.id, upstreamModel: e.target.value })}
								/>
							</TD>
							<TD className="text-right font-mono text-[12px] text-ink-2">{(m.contextWindow / 1000).toFixed(0)}K</TD>
							<TD className="text-right whitespace-nowrap font-mono text-[12px] tabular-nums">
								{m.priceIn === 0 && m.priceOut === 0 ? (
									<Badge className="border-[#bcd9c0] text-[#1d7a33]">{t("credits.free")}</Badge>
								) : (
									<>
										{m.priceIn} <span className="text-ink-2">/</span> {m.priceOut}
									</>
								)}
							</TD>
							<TD>
								<Switch checked={m.enabled} onCheckedChange={(v) => onPatch({ id: m.id, enabled: v })} />
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
	);
}
