import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@web/lib/utils";
import { Input } from "@web/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";

interface ModelFilterBarProps {
	search: string;
	onSearchChange: (v: string) => void;
	provider: string;
	onProviderChange: (v: string) => void;
	status: string;
	onStatusChange: (v: string) => void;
	providers: string[];
	shownCount: number;
	totalCount: number;
	showStatusFilter?: boolean;
}

export function ModelFilterBar({
	search,
	onSearchChange,
	provider,
	onProviderChange,
	status,
	onStatusChange,
	providers,
	shownCount,
	totalCount,
	showStatusFilter = true,
}: ModelFilterBarProps) {
	const { t } = useTranslation();
	const hasActiveFilters = search.trim() !== "" || provider !== "all" || status !== "all";

	const resetFilters = () => {
		onSearchChange("");
		onProviderChange("all");
		onStatusChange("all");
	};

	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex flex-1 flex-wrap items-center gap-2.5">
				{/* Search Box */}
				<div className="relative min-w-[220px] max-w-sm flex-1">
					<Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" />
					<Input
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder={t("adminModels.searchPlaceholder")}
						className="pl-8 pr-8 text-xs font-mono"
					/>
					{search && (
						<button
							type="button"
							onClick={() => onSearchChange("")}
							className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-2 hover:text-ink cursor-pointer"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					)}
				</div>

				{/* Provider Filter */}
				<div className="w-[140px]">
					<Select value={provider} onValueChange={onProviderChange}>
						<SelectTrigger aria-label={t("adminModels.filterProvider")} className="h-9 text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">{t("adminModels.filterProvider")}</SelectItem>
							{providers.map((p) => (
								<SelectItem key={p} value={p} className="capitalize">
									{p}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Status Filter */}
				{showStatusFilter && (
					<div className="w-[140px]">
						<Select value={status} onValueChange={onStatusChange}>
							<SelectTrigger aria-label={t("adminModels.filterStatus")} className="h-9 text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">{t("adminModels.filterStatus")}</SelectItem>
								<SelectItem value="enabled">{t("adminModels.statusEnabled")}</SelectItem>
								<SelectItem value="disabled">{t("adminModels.statusDisabled")}</SelectItem>
							</SelectContent>
						</Select>
					</div>
				)}

				{/* Clear filters button */}
				{hasActiveFilters && (
					<button
						type="button"
						onClick={resetFilters}
						className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-ink-2 hover:text-ink hover:bg-paper-2 transition-colors cursor-pointer"
					>
						<X className="h-3 w-3" />
						<span>{t("adminModels.clearFilters")}</span>
					</button>
				)}
			</div>

			{/* Count display */}
			<div className="text-xs font-mono text-ink-2 shrink-0">
				{t("adminModels.showingCount", { shown: shownCount, total: totalCount })}
			</div>
		</div>
	);
}
