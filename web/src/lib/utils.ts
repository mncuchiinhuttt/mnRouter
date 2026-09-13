import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function fmtNum(n: number | string | null | undefined): string {
	const v = Number(n ?? 0);
	return v.toLocaleString("en-US");
}

export function fmtCompact(n: number | string | null | undefined): string {
	const v = Number(n ?? 0);
	if (Math.abs(v) >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
	if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
	if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
	return String(v);
}

export function fmtDate(d: string | Date | null | undefined): string {
	if (!d) return "—";
	return new Date(d).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
