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
	const abs = Math.abs(v);
	if (abs >= 1_000_000_000) {
		const val = v / 1_000_000_000;
		return `${Number(val.toFixed(val >= 10 ? 0 : 1))}B`;
	}
	if (abs >= 1_000_000) {
		if (abs >= 1_000_000 && abs <= 1_050_000) return "1M";
		if (abs >= 2_000_000 && abs <= 2_100_000) return "2M";
		const val = v / 1_000_000;
		return `${Number(val.toFixed(val >= 10 ? 0 : 1))}M`;
	}
	if (abs >= 1_000) {
		const val = v / 1_000;
		return `${Number(val.toFixed(val >= 10 ? 0 : 1))}K`;
	}
	return String(v);
}

export function fmtDate(d: string | Date | null | undefined): string {
	if (!d) return "—";
	return new Date(d).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
