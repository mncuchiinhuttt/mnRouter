import { useTranslation } from "react-i18next";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtCompact, fmtNum } from "@web/lib/utils";

const PROVIDER_COLORS: Record<string, string> = {
	claude: "#d97706",
	codex: "#10a37f",
	antigravity: "#2563eb",
	grok: "#1e293b",
	kiro: "#db2777",
	opencode: "#7c3aed",
};

export function CreditsTrendChart({ data, height = 320 }: { data: { date: string; tokens: number; credits: number }[]; height?: number }) {
	const { t } = useTranslation();
	return (
		<ResponsiveContainer width="100%" height={height}>
			<ComposedChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
				<CartesianGrid stroke="#e3e3dc" vertical={false} />
				<XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#55556b" }} tickLine={false} axisLine={{ stroke: "#d9d9d3" }} />
				<YAxis yAxisId="left" tickFormatter={(v) => fmtCompact(v as number)} tick={{ fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#55556b" }} tickLine={false} axisLine={false} width={46} />
				<YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}cr`} tick={{ fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#d97706" }} tickLine={false} axisLine={false} width={46} />
				<Tooltip
					contentStyle={{ borderRadius: 6, border: "1px solid #d9d9d3", fontSize: 12, fontFamily: "IBM Plex Mono", backgroundColor: "#fff" }}
					formatter={(val, name) => [name === "credits" ? `${Number(val).toFixed(2)} cr` : fmtNum(Number(val)), name === "credits" ? t("credits.credits") : t("common.tokens")]}
				/>
				<Legend wrapperStyle={{ fontSize: 11, fontFamily: "IBM Plex Mono", paddingTop: 8 }} />
				<Area yAxisId="left" type="monotone" dataKey="tokens" name={t("common.tokens")} stroke="#2323e6" fill="#2323e6" fillOpacity={0.12} strokeWidth={2} />
				<Line yAxisId="right" type="monotone" dataKey="credits" name={t("credits.credits")} stroke="#d97706" strokeWidth={2.5} dot={{ r: 3, fill: "#d97706" }} />
			</ComposedChart>
		</ResponsiveContainer>
	);
}

export function TokenStackChart({ data, height = 320 }: { data: { date: string; prompt: number; cacheRead: number; completion: number }[]; height?: number }) {
	const { t } = useTranslation();
	return (
		<ResponsiveContainer width="100%" height={height}>
			<BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
				<CartesianGrid stroke="#e3e3dc" vertical={false} />
				<XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#55556b" }} tickLine={false} axisLine={{ stroke: "#d9d9d3" }} />
				<YAxis tickFormatter={(v) => fmtCompact(v as number)} tick={{ fontSize: 10, fontFamily: "IBM Plex Mono", fill: "#55556b" }} tickLine={false} axisLine={false} width={46} />
				<Tooltip
					contentStyle={{ borderRadius: 6, border: "1px solid #d9d9d3", fontSize: 12, fontFamily: "IBM Plex Mono", backgroundColor: "#fff" }}
					formatter={(val, name) => [fmtNum(Number(val)), String(name)]}
				/>
				<Legend wrapperStyle={{ fontSize: 11, fontFamily: "IBM Plex Mono", paddingTop: 8 }} />
				<Bar dataKey="prompt" stackId="tokens" name={t("usage.input")} fill="#3b82f6" />
				<Bar dataKey="cacheRead" stackId="tokens" name={t("usage.cacheRead")} fill="#10b981" />
				<Bar dataKey="completion" stackId="tokens" name={t("usage.output")} fill="#8b5cf6" radius={[2, 2, 0, 0]} />
			</BarChart>
		</ResponsiveContainer>
	);
}

export function ProviderDonutChart({ data, height = 300 }: { data: { name: string; value: number; requests: number }[]; height?: number }) {
	const total = data.reduce((acc, d) => acc + d.value, 0);
	return (
		<div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:justify-around">
			<div className="h-[240px] w-[240px] shrink-0">
				<ResponsiveContainer width="100%" height="100%">
					<PieChart>
						<Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3} stroke="none">
							{data.map((entry) => (
								<Cell key={entry.name} fill={PROVIDER_COLORS[entry.name.toLowerCase()] ?? "#6366f1"} />
							))}
						</Pie>
						<Tooltip
							contentStyle={{ borderRadius: 6, border: "1px solid #d9d9d3", fontSize: 12, fontFamily: "IBM Plex Mono", backgroundColor: "#fff" }}
							formatter={(v, name) => [`${fmtCompact(Number(v))} (${total > 0 ? ((Number(v) / total) * 100).toFixed(1) : 0}%)`, String(name)]}
						/>
					</PieChart>
				</ResponsiveContainer>
			</div>
			<div className="flex flex-wrap gap-2.5 sm:max-w-xs sm:flex-col">
				{data.map((item) => {
					const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
					const color = PROVIDER_COLORS[item.name.toLowerCase()] ?? "#6366f1";
					return (
						<div key={item.name} className="flex items-center gap-2 rounded-sm border border-line bg-paper-2 px-2.5 py-1 font-mono text-xs">
							<span className="size-2 rounded-full" style={{ backgroundColor: color }} />
							<span className="font-medium text-ink uppercase">{item.name}</span>
							<span className="ml-auto text-ink-2 tabular-nums">{pct}%</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
