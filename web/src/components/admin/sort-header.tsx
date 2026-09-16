import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@web/lib/utils";
import type { SortOrder } from "./model-types";

interface SortHeaderProps<T extends string> {
	label: string;
	columnKey: T;
	currentKey: T;
	order: SortOrder;
	onSort: (key: T) => void;
	align?: "left" | "right";
}

export function SortHeader<T extends string>({
	label,
	columnKey,
	currentKey,
	order,
	onSort,
	align = "left",
}: SortHeaderProps<T>) {
	const active = currentKey === columnKey && order !== null;

	return (
		<button
			type="button"
			onClick={() => onSort(columnKey)}
			className={cn(
				"group inline-flex items-center gap-1.5 select-none font-mono text-[11px] uppercase tracking-wider transition-colors hover:text-ink cursor-pointer",
				active ? "text-accent font-semibold" : "text-ink-2",
				align === "right" && "flex-row-reverse"
			)}
		>
			<span>{label}</span>
			{active && order === "asc" ? (
				<ArrowUp className="h-3.5 w-3.5 text-accent shrink-0" />
			) : active && order === "desc" ? (
				<ArrowDown className="h-3.5 w-3.5 text-accent shrink-0" />
			) : (
				<ArrowUpDown className="h-3.5 w-3.5 opacity-30 transition-opacity group-hover:opacity-100 shrink-0" />
			)}
		</button>
	);
}
