import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Cpu, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Badge, Table, THead, TBody, TR, TH, TD } from "@web/components/ui/primitives";
import { Button } from "@web/components/ui/button";
import { fmtCompact } from "@web/lib/utils";
import type { ModelItem } from "@web/components/chat/thread-sidebar";

interface ModelDirectoryViewProps {
	models: ModelItem[];
}

export function ModelDirectoryView({ models }: ModelDirectoryViewProps) {
	const { t } = useTranslation();
	const [selectedProvider, setSelectedProvider] = useState<string>("all");
	const [search, setSearch] = useState<string>("");
	const [copiedId, setCopiedId] = useState<string | null>(null);

	const providers = useMemo(() => {
		const set = new Set<string>();
		for (const m of models) if (m.provider) set.add(m.provider.toLowerCase());
		return ["all", ...Array.from(set)];
	}, [models]);

	const filteredModels = useMemo(() => {
		const q = search.trim().toLowerCase();
		return models.filter((m) => {
			if (selectedProvider !== "all" && m.provider?.toLowerCase() !== selectedProvider) return false;
			if (!q) return true;
			return (
				m.id.toLowerCase().includes(q) ||
				(m.displayName || "").toLowerCase().includes(q) ||
				(m.provider || "").toLowerCase().includes(q)
			);
		});
	}, [models, selectedProvider, search]);

	const copyModelId = (id: string) => {
		navigator.clipboard.writeText(id);
		setCopiedId(id);
		toast.success(t("modelsDirectory.copied", { id }));
		setTimeout(() => setCopiedId(null), 2000);
	};

	return (
		<div className="space-y-4">
			{/* Controls: Search & Provider Filters */}
			<div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
				{/* Search Input */}
				<div className="relative w-full sm:max-w-xs">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-2" />
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={t("modelsDirectory.searchPlaceholder")}
						className="h-8 w-full rounded-md border border-line bg-paper pl-8 pr-7 font-mono text-xs text-ink placeholder:text-ink-2/60 focus:border-accent focus:outline-none"
					/>
					{search && (
						<button
							type="button"
							onClick={() => setSearch("")}
							className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-2 hover:text-ink cursor-pointer"
						>
							<X className="size-3" />
						</button>
					)}
				</div>

				{/* Provider Filter Chips */}
				<div className="flex flex-wrap items-center gap-1.5">
					{providers.map((p) => (
						<button
							key={p}
							type="button"
							onClick={() => setSelectedProvider(p)}
							className={`rounded-md border px-2.5 py-1 font-mono text-[11px] capitalize transition cursor-pointer ${
								selectedProvider === p
									? "border-accent bg-accent text-white font-medium shadow-2xs"
									: "border-line bg-paper text-ink-2 hover:border-ink hover:text-ink"
							}`}
						>
							{p === "all" ? t("common.all") + " (" + models.length + ")" : p}
						</button>
					))}
				</div>
			</div>

			{/* Models Table */}
			<div className="overflow-hidden rounded-xl border border-line bg-white shadow-2xs">
				<div className="overflow-x-auto">
					<Table>
						<THead>
							<TR>
								<TH className="w-1/3">{t("modelsDirectory.colModel")}</TH>
								<TH>{t("modelsDirectory.colId")}</TH>
								<TH className="text-right">{t("modelsDirectory.colInput")}</TH>
								<TH className="text-right">{t("modelsDirectory.colOutput")}</TH>
								<TH className="text-right">{t("modelsDirectory.colCache")}</TH>
								<TH className="text-right w-24">{t("common.actions")}</TH>
							</TR>
						</THead>
						<TBody>
							{filteredModels.length === 0 ? (
								<TR>
									<TD colSpan={6} className="py-8 text-center text-xs text-ink-2 font-mono">
										{t("modelsDirectory.noModels")}
									</TD>
								</TR>
							) : (
								filteredModels.map((m) => {
									const isFree = (m.priceIn ?? 0) === 0 && (m.priceOut ?? 0) === 0;
									const cachePrice = m.priceCacheRead ?? Math.round((m.priceIn ?? 0) * 0.1);
									const isCopied = copiedId === m.id;

									return (
										<TR key={m.id} className="hover:bg-paper-2/50 transition">
											<TD>
												<div className="flex items-center gap-2">
													<div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-paper-2 border border-line text-accent">
														<Cpu className="size-3.5" />
													</div>
													<div className="min-w-0">
														<div className="font-semibold text-xs text-ink truncate">
															{m.displayName || m.id}
														</div>
														<Badge className="mt-0.5 text-[9px] uppercase font-mono">
															{m.provider}
														</Badge>
													</div>
												</div>
											</TD>
											<TD>
												<div className="flex items-center gap-1.5 font-mono text-xs text-ink">
													<code className="rounded bg-paper px-1.5 py-0.5 border border-line/60 select-all">
														{m.id}
													</code>
												</div>
											</TD>
											<TD className="text-right font-mono text-xs tabular-nums">
												{isFree ? (
													<span className="text-[#1d7a33] font-semibold">0</span>
												) : (
													<span className="font-medium text-ink">{m.priceIn ?? 0}</span>
												)}
											</TD>
											<TD className="text-right font-mono text-xs tabular-nums">
												{isFree ? (
													<span className="text-[#1d7a33] font-semibold">0</span>
												) : (
													<span className="font-medium text-ink">{m.priceOut ?? 0}</span>
												)}
											</TD>
											<TD className="text-right font-mono text-xs tabular-nums">
												{isFree ? (
													<span className="text-[#1d7a33] font-semibold">0</span>
												) : (
													<span className="font-medium text-ink">{cachePrice}</span>
												)}
											</TD>
											<TD className="text-right">
												<Button
													size="sm"
													variant={isCopied ? "outline" : "outline"}
													className={`h-7 px-2 font-mono text-[10.5px] gap-1 cursor-pointer ${
														isCopied ? "border-[#bcd9c0] text-[#1d7a33] bg-[#f4faf5]" : ""
													}`}
													onClick={() => copyModelId(m.id)}
													title="Copy Model ID"
												>
													<span>{isCopied ? t("common.copied") : t("modelsDirectory.copyId")}</span>
												</Button>
											</TD>
										</TR>
									);
								})
							)}
						</TBody>
					</Table>
				</div>
			</div>
		</div>
	);
}
