import { useTranslation } from "react-i18next";
import { FileCode, Server, Sparkles, Wrench } from "lucide-react";

interface McpSummaryCardsProps {
	serversCount: number;
	activeServersCount: number;
	totalTools: number;
	customSkillsCount: number;
	activeCustomSkillsCount: number;
	builtInCount: number;
	onSelectTab?: (tab: "mcp" | "skills" | "builtin") => void;
}

export function McpSummaryCards({
	serversCount,
	activeServersCount,
	totalTools,
	customSkillsCount,
	activeCustomSkillsCount,
	builtInCount,
	onSelectTab,
}: McpSummaryCardsProps) {
	const { t } = useTranslation();

	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{/* Servers Card */}
			<div
				onClick={() => onSelectTab?.("mcp")}
				className="rounded-xl border border-line bg-white p-4 shadow-2xs hover:border-accent transition cursor-pointer"
			>
				<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase tracking-wider">
					<span>{t("mcp.metricServers")}</span>
					<Server className="size-4 text-accent" />
				</div>
				<div className="mt-2 flex items-baseline gap-1.5 font-mono">
					<span className="text-2xl font-bold text-ink">{activeServersCount}</span>
					<span className="text-xs text-ink-2">/ {serversCount} {t("mcp.total")}</span>
				</div>
				<p className="mt-1 text-[11px] text-ink-2 font-mono">{t("mcp.metricActiveServers")}</p>
			</div>

			{/* Tools Card */}
			<div
				onClick={() => onSelectTab?.("mcp")}
				className="rounded-xl border border-line bg-white p-4 shadow-2xs hover:border-accent transition cursor-pointer"
			>
				<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase tracking-wider">
					<span>{t("mcp.metricTools")}</span>
					<Wrench className="size-4 text-emerald-600" />
				</div>
				<div className="mt-2 flex items-baseline gap-1.5 font-mono">
					<span className="text-2xl font-bold text-emerald-600">{totalTools}</span>
					<span className="text-xs text-ink-2">{t("mcp.toolsCount")}</span>
				</div>
				<p className="mt-1 text-[11px] text-ink-2 font-mono">{t("mcp.metricToolsDesc")}</p>
			</div>

			{/* Custom Skills Card */}
			<div
				onClick={() => onSelectTab?.("skills")}
				className="rounded-xl border border-line bg-white p-4 shadow-2xs hover:border-accent transition cursor-pointer"
			>
				<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase tracking-wider">
					<span>{t("mcp.metricCustom")}</span>
					<FileCode className="size-4 text-accent" />
				</div>
				<div className="mt-2 flex items-baseline gap-1.5 font-mono">
					<span className="text-2xl font-bold text-ink">{activeCustomSkillsCount}</span>
					<span className="text-xs text-ink-2">/ {customSkillsCount} {t("mcp.filesCount")}</span>
				</div>
				<p className="mt-1 text-[11px] text-ink-2 font-mono">{t("mcp.metricCustomDesc")}</p>
			</div>

			{/* Built-in Skills Card */}
			<div
				onClick={() => onSelectTab?.("builtin")}
				className="rounded-xl border border-line bg-white p-4 shadow-2xs hover:border-accent transition cursor-pointer"
			>
				<div className="flex items-center justify-between text-ink-2 font-mono text-[11px] uppercase tracking-wider">
					<span>{t("mcp.metricBuiltIn")}</span>
					<Sparkles className="size-4 text-accent" />
				</div>
				<div className="mt-2 flex items-baseline gap-1.5 font-mono">
					<span className="text-2xl font-bold text-ink">{builtInCount}</span>
					<span className="text-xs text-ink-2">{t("mcp.skillsCount")}</span>
				</div>
				<p className="mt-1 text-[11px] text-ink-2 font-mono">{t("mcp.metricBuiltInDesc")}</p>
			</div>
		</div>
	);
}
