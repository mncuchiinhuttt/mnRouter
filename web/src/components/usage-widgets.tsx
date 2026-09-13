import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtCompact, fmtNum } from "@web/lib/utils";

export function StatStrip({ cells }: { cells: { label: string; value: string; highlight?: boolean }[] }) {
	return (
		<div className="grid grid-cols-2 border border-line bg-white sm:grid-cols-3 lg:grid-cols-6">
			{cells.map((cell, i) => (
				<div
					key={cell.label}
					className={
						"flex min-h-[104px] flex-col justify-between border-line p-4 [&:not(:last-child)]:border-r max-lg:[&:nth-child(-n+4)]:border-b max-sm:[&:nth-child(-n+5)]:border-b" +
						(i === cells.length - 1 ? " max-lg:[&:nth-child(3)]:border-r-0" : "")
					}
					style={cell.highlight ? { background: "var(--color-accent)", borderColor: "var(--color-accent)" } : undefined}
				>
					<div className={"stat-number text-[34px] leading-none " + (cell.highlight ? "text-white" : "text-ink")}>{cell.value}</div>
					<div className={"label-mono " + (cell.highlight ? "text-white/80" : "text-ink-2")}>{cell.label}</div>
				</div>
			))}
		</div>
	);
}

export function SpendArea({ data, height = 320 }: { data: { date: string; total: number }[]; height?: number }) {
	return (
		<ResponsiveContainer width="100%" height={height}>
			<AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
				<CartesianGrid stroke="#e3e3dc" vertical={false} />
				<XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#55556b" }} tickLine={false} axisLine={{ stroke: "#d9d9d3" }} />
				<YAxis tickFormatter={(v) => fmtCompact(v as number)} tick={{ fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#55556b" }} tickLine={false} axisLine={false} width={48} />
				<Tooltip
					contentStyle={{ borderRadius: 6, border: "1px solid #d9d9d3", fontSize: 12, fontFamily: "IBM Plex Mono" }}
					formatter={(v) => [fmtNum(Number(v)), "tokens"]}
				/>
				<Area type="monotone" dataKey="total" stroke="#2323e6" fill="#2323e6" fillOpacity={0.14} strokeWidth={2} />
			</AreaChart>
		</ResponsiveContainer>
	);
}

export function ModelBars({ data, height = 320 }: { data: { model: string; tokens: number }[]; height?: number }) {
	return (
		<ResponsiveContainer width="100%" height={height}>
			<BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
				<CartesianGrid stroke="#e3e3dc" horizontal={false} />
				<XAxis type="number" tickFormatter={(v) => fmtCompact(v as number)} tick={{ fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#55556b" }} tickLine={false} axisLine={{ stroke: "#d9d9d3" }} />
				<YAxis type="category" dataKey="model" width={170} tick={{ fontSize: 10.5, fontFamily: "IBM Plex Mono", fill: "#16162b" }} tickLine={false} axisLine={false} />
				<Tooltip contentStyle={{ borderRadius: 6, border: "1px solid #d9d9d3", fontSize: 12, fontFamily: "IBM Plex Mono" }} formatter={(v) => [fmtNum(Number(v)), "tokens"]} />
				<Bar dataKey="tokens" fill="#2323e6" radius={[0, 2, 2, 0]} barSize={16} />
			</BarChart>
		</ResponsiveContainer>
	);
}
