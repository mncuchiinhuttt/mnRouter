import { useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";

export interface ModelOption {
	id: string;
	displayName: string;
	provider: string;
}

interface ModelPickerProps {
	models: ModelOption[];
	allModels: boolean;
	modelIds: string[];
	onAllModelsChange: (value: boolean) => void;
	onModelIdsChange: (value: string[]) => void;
	t: (key: string, options?: Record<string, unknown>) => string;
}

export function ModelPicker({ models, allModels, modelIds, onAllModelsChange, onModelIdsChange, t }: ModelPickerProps) {
	const [filter, setFilter] = useState("");

	const providerGroups = useMemo(() => {
		const map: Record<string, ModelOption[]> = {};
		for (const m of models) {
			const p = m.provider || "other";
			if (!map[p]) map[p] = [];
			map[p].push(m);
		}
		return map;
	}, [models]);

	const toggleProvider = (provider: string) => {
		const pIds = (providerGroups[provider] ?? []).map((m) => m.id);
		const allSelected = pIds.every((id) => modelIds.includes(id));
		if (allSelected) {
			onModelIdsChange(modelIds.filter((id) => !pIds.includes(id)));
		} else {
			if (allModels) onAllModelsChange(false);
			onModelIdsChange(Array.from(new Set([...modelIds, ...pIds])));
		}
	};

	const filteredModels = useMemo(() => {
		if (!filter.trim()) return models;
		const q = filter.trim().toLowerCase();
		return models.filter((m) => m.id.toLowerCase().includes(q) || m.displayName.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q));
	}, [models, filter]);

	const toggleSingle = (id: string) => {
		if (modelIds.includes(id)) {
			onModelIdsChange(modelIds.filter((mId) => mId !== id));
		} else {
			if (allModels) onAllModelsChange(false);
			onModelIdsChange([...modelIds, id]);
		}
	};

	return (
		<div className="space-y-3 rounded-lg border border-line bg-paper p-3 text-xs">
			<div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
				<label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
					<input type="checkbox" checked={allModels} onChange={(e) => onAllModelsChange(e.target.checked)} className="rounded" />
					<span>{t("adminUsers.allModels")}</span>
				</label>
				<span className="font-mono text-[11px] text-ink-2">
					{allModels ? t("adminUsers.modelCount", { count: models.length }) : `${modelIds.length}/${models.length} models`}
				</span>
			</div>

			{/* Quick Select by Provider */}
			<div className="space-y-1.5">
				<div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-ink-2">
					<span>{t("adminUsers.quickSelectProvider")}</span>
					{!allModels && modelIds.length > 0 && (
						<button type="button" onClick={() => onModelIdsChange([])} className="text-[#c6293b] hover:underline cursor-pointer">
							{t("adminUsers.clearAll")}
						</button>
					)}
				</div>
				<div className="flex flex-wrap gap-1.5">
					{Object.entries(providerGroups).map(([prov, pModels]) => {
						const pIds = pModels.map((m) => m.id);
						const count = pIds.filter((id) => modelIds.includes(id)).length;
						const isAllSelected = !allModels && pIds.length > 0 && count === pIds.length;
						const isPartial = !allModels && count > 0 && count < pIds.length;

						return (
							<button
								key={prov}
								type="button"
								onClick={() => toggleProvider(prov)}
								disabled={allModels}
								className={`inline-flex items-center gap-1 rounded border px-2 py-1 font-mono text-[10.5px] transition cursor-pointer ${
									allModels
										? "border-line bg-white/40 text-ink-2/40 cursor-not-allowed"
										: isAllSelected
										? "border-accent bg-accent text-white font-medium shadow-2xs"
										: isPartial
										? "border-accent/40 bg-[#f6f8ff] text-accent font-medium"
										: "border-line bg-white text-ink-2 hover:border-ink hover:text-ink"
								}`}
								title={`Bật/tắt tất cả ${pModels.length} models của ${prov}`}
							>
								{isAllSelected ? <Check className="size-3" /> : <Plus className="size-3" />}
								<span className="capitalize">{prov}</span>
								<span className="text-[9.5px] opacity-80">({count}/{pModels.length})</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* Individual Models Checklist */}
			<div className={`space-y-2 ${allModels ? "pointer-events-none opacity-40" : ""}`}>
				<div className="flex items-center justify-between gap-2">
					<div className="label-mono text-ink-2 text-[10.5px]">{t("adminUsers.detailedList")}</div>
					<div className="relative w-44">
						<Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-ink-2" />
						<input
							type="text"
							value={filter}
							onChange={(e) => setFilter(e.target.value)}
							placeholder={t("adminUsers.searchModel")}
							disabled={allModels}
							className="h-6 w-full rounded border border-line bg-white pl-6 pr-2 font-mono text-[10.5px] text-ink placeholder:text-ink-2/60 focus:border-accent focus:outline-none"
						/>
						{filter && (
							<button type="button" onClick={() => setFilter("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-2 hover:text-ink">
								<X className="size-2.5" />
							</button>
						)}
					</div>
				</div>

				<div className="grid max-h-48 gap-1 overflow-y-auto rounded border border-line/60 bg-white p-1.5 sm:grid-cols-2">
					{filteredModels.map((model) => {
						const isChecked = modelIds.includes(model.id);
						return (
							<label key={model.id} className={`flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-xs transition ${isChecked ? "bg-[#f6f8ff] text-accent" : "hover:bg-paper-2 text-ink"}`}>
								<input type="checkbox" checked={isChecked} disabled={allModels} onChange={() => toggleSingle(model.id)} className="mt-0.5 rounded" />
								<span className="min-w-0 flex-1">
									<span className="block truncate font-mono text-[11px] font-medium">{model.id}</span>
									<span className="block truncate text-[10px] text-ink-2">
										<span className="capitalize font-mono">{model.provider}</span> &middot; {model.displayName}
									</span>
								</span>
							</label>
						);
					})}
					{filteredModels.length === 0 && (
						<span className="col-span-2 py-4 text-center text-xs text-ink-2">{t("adminUsers.noModels")}</span>
					)}
				</div>
			</div>
		</div>
	);
}
