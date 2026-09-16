import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface PaginationProps {
	page: number;
	totalPages: number;
	total: number;
	limit: number;
	onPageChange: (page: number) => void;
	onLimitChange?: (limit: number) => void;
	limitOptions?: number[];
	itemLabel?: string;
}

export function Pagination({
	page,
	totalPages,
	total,
	limit,
	onPageChange,
	onLimitChange,
	limitOptions = [50, 100, 200],
	itemLabel,
}: PaginationProps) {
	const { t } = useTranslation();
	const safeTotalPages = Math.max(1, totalPages);
	const start = total === 0 ? 0 : (page - 1) * limit + 1;
	const end = Math.min(total, page * limit);

	// Calculate visible page range around current page
	const getVisiblePages = () => {
		const pages: (number | "...")[] = [];
		if (safeTotalPages <= 7) {
			for (let i = 1; i <= safeTotalPages; i++) pages.push(i);
		} else {
			pages.push(1);
			if (page > 3) pages.push("...");
			const startPage = Math.max(2, page - 1);
			const endPage = Math.min(safeTotalPages - 1, page + 1);
			for (let i = startPage; i <= endPage; i++) pages.push(i);
			if (page < safeTotalPages - 2) pages.push("...");
			pages.push(safeTotalPages);
		}
		return pages;
	};

	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-3 px-3 text-xs text-ink-2 font-mono">
			{/* Left: Range and total count */}
			<div className="flex items-center gap-2">
				<span>
					{t("pagination.showing", {
						start: start.toLocaleString(),
						end: end.toLocaleString(),
						total: total.toLocaleString(),
						label: itemLabel || t("pagination.requests"),
					})}
				</span>
			</div>

			{/* Right: Per-page selector & Page numbers */}
			<div className="flex flex-wrap items-center gap-2 sm:gap-3">
				{onLimitChange && (
					<div className="flex items-center gap-1.5 mr-1">
						<span>{t("pagination.perPage")}:</span>
						<div className="flex items-center rounded-md border border-line bg-paper p-0.5">
							{limitOptions.map((opt) => (
								<button
									key={opt}
									type="button"
									onClick={() => onLimitChange(opt)}
									className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition ${
										limit === opt ? "bg-accent text-white font-medium shadow-2xs" : "text-ink-2 hover:text-ink"
									}`}
								>
									{opt}
								</button>
							))}
						</div>
					</div>
				)}

				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => onPageChange(1)}
						disabled={page <= 1}
						title={t("pagination.first")}
						className="p-1 rounded border border-line bg-white hover:bg-paper disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-ink"
					>
						<ChevronsLeft className="size-3.5" />
					</button>
					<button
						type="button"
						onClick={() => onPageChange(page - 1)}
						disabled={page <= 1}
						title={t("pagination.prev")}
						className="p-1 rounded border border-line bg-white hover:bg-paper disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-ink"
					>
						<ChevronLeft className="size-3.5" />
					</button>

					<div className="flex items-center gap-1 px-1">
						{getVisiblePages().map((p, idx) =>
							p === "..." ? (
								<span key={`dots-${idx}`} className="px-1 text-ink-2 select-none">
									…
								</span>
							) : (
								<button
									key={p}
									type="button"
									onClick={() => onPageChange(p)}
									className={`min-w-6 h-6 px-1.5 rounded font-mono text-[11px] transition cursor-pointer ${
										p === page
											? "border border-accent bg-accent text-white font-semibold shadow-2xs"
											: "border border-line/60 bg-white text-ink hover:bg-paper hover:border-ink"
									}`}
								>
									{p}
								</button>
							)
						)}
					</div>

					<button
						type="button"
						onClick={() => onPageChange(page + 1)}
						disabled={page >= safeTotalPages}
						title={t("pagination.next")}
						className="p-1 rounded border border-line bg-white hover:bg-paper disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-ink"
					>
						<ChevronRight className="size-3.5" />
					</button>
					<button
						type="button"
						onClick={() => onPageChange(safeTotalPages)}
						disabled={page >= safeTotalPages}
						title={t("pagination.last")}
						className="p-1 rounded border border-line bg-white hover:bg-paper disabled:opacity-30 disabled:pointer-events-none cursor-pointer text-ink"
					>
						<ChevronsRight className="size-3.5" />
					</button>
				</div>
			</div>
		</div>
	);
}
