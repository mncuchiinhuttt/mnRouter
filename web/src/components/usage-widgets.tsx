import { useTranslation } from "react-i18next";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtCompact, fmtNum } from "@web/lib/utils";
export function StatStrip({ cells }: { cells: { label: string; value: string; highlight?: boolean }[] }) {
	const firstValLen = cells[0]?.value.length ?? 0;
	const isFirstExtraWide = firstValLen >= 9;

	return (
		<div
			className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3"
			style={{
				gridTemplateColumns: isFirstExtraWide
					? "repeat(auto-fit, minmax(130px, 1fr))"
					: undefined,
			}}
		>
			<div
				className={`grid col-span-2 sm:col-span-3 lg:col-span-6 gap-px bg-line ${
					isFirstExtraWide
						? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1.35fr_1fr_1fr_1fr_1fr_0.85fr]"
						: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
				}`}
			>
				{cells.map((cell, idx) => {
					const isFirst = idx === 0;
					const valLen = cell.value.length;

					const fontSizeClass = isFirst
						? valLen > 13
							? "text-[23px] sm:text-[25px]"
							: valLen > 10
							? "text-[26px] sm:text-[29px]"
							: "text-[30px] sm:text-[34px]"
						: valLen > 8
						? "text-[24px] sm:text-[26px]"
						: "text-[30px] sm:text-[34px]";

					return (
						<div
							key={cell.label}
							className={`flex min-h-[96px] flex-col justify-between gap-2 p-4 sm:min-h-[104px] overflow-hidden ${
								isFirst && isFirstExtraWide ? "px-4 sm:px-5" : ""
							}`}
							style={cell.highlight ? { background: "var(--color-accent)" } : { background: "var(--color-paper)" }}
						>
							<div
								className={`stat-number font-semibold leading-none tracking-tight whitespace-nowrap truncate ${fontSizeClass} ${
									cell.highlight ? "text-white" : "text-ink"
								}`}
								title={cell.value}
							>
								{cell.value}
							</div>
							<div className={"label-mono text-[10px] sm:text-[11px] truncate " + (cell.highlight ? "text-white/80" : "text-ink-2")}>
								{cell.label}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export function SpendArea({ data, height = 320 }: { data: { date: string; total: number }[]; height?: number }) {
	const { t } = useTranslation();
	return (
		<ResponsiveContainer width="100%" height={height}>
			<AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
				<CartesianGrid stroke="#e3e3dc" vertical={false} />
				<XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#55556b" }} tickLine={false} axisLine={{ stroke: "#d9d9d3" }} />
				<YAxis tickFormatter={(v) => fmtCompact(v as number)} tick={{ fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#55556b" }} tickLine={false} axisLine={false} width={48} />
				<Tooltip
					contentStyle={{ borderRadius: 6, border: "1px solid #d9d9d3", fontSize: 12, fontFamily: "IBM Plex Mono" }}
					formatter={(v) => [fmtNum(Number(v)), t("common.tokens")]}
				/>
				<Area type="monotone" dataKey="total" stroke="#2323e6" fill="#2323e6" fillOpacity={0.14} strokeWidth={2} />
			</AreaChart>
		</ResponsiveContainer>
	);
}

export function ModelBars({ data, height = 320 }: { data: { model: string; tokens: number }[]; height?: number }) {
	const { t } = useTranslation();
	return (
		<ResponsiveContainer width="100%" height={height}>
			<BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
				<CartesianGrid stroke="#e3e3dc" horizontal={false} />
				<XAxis type="number" tickFormatter={(v) => fmtCompact(v as number)} tick={{ fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#55556b" }} tickLine={false} axisLine={{ stroke: "#d9d9d3" }} />
				<YAxis type="category" dataKey="model" width={170} tick={{ fontSize: 10.5, fontFamily: "IBM Plex Mono", fill: "#16162b" }} tickLine={false} axisLine={false} />
				<Tooltip contentStyle={{ borderRadius: 6, border: "1px solid #d9d9d3", fontSize: 12, fontFamily: "IBM Plex Mono" }} formatter={(v) => [fmtNum(Number(v)), t("common.tokens")]} />
				<Bar dataKey="tokens" fill="#2323e6" radius={[0, 2, 2, 0]} barSize={16} />
			</BarChart>
		</ResponsiveContainer>
	);
}
