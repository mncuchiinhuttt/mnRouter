import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, AlertTriangle, CheckCircle2, Globe, Play, Plus, RefreshCw, Server, Terminal, Trash2, Zap } from "lucide-react";
import { Button } from "@web/components/ui/button";
import { Badge } from "@web/components/ui/primitives";
import type { McpTemplate } from "../../../../src/server/services/mcp.service";

export interface McpServerItem {
	id: string;
	name: string;
	transport: "sse" | "http" | "stdio";
	url: string | null;
	command: string | null;
	args: string | null;
	env: string | null;
	status: "connected" | "disconnected" | "error";
	enabled: boolean;
	toolsCount: number;
	lastPingAt: string | null;
	createdAt: string;
}

interface McpServerListProps {
	servers: McpServerItem[];
	templates: McpTemplate[];
	onSelectTemplate: (t: McpTemplate) => void;
	onPing: (id: string) => void;
	onToggle: (id: string, enabled: boolean) => void;
	onDelete: (id: string) => void;
	onOpenAdd: () => void;
	pingingId: string | null;
}

export function McpServerList({
	servers,
	templates,
	onSelectTemplate,
	onPing,
	onToggle,
	onDelete,
	onOpenAdd,
	pingingId,
}: McpServerListProps) {
	const { t } = useTranslation();

	return (
		<div className="space-y-6">
			{/* Quick Connect Templates Bar */}
			<div className="rounded-xl border border-line bg-paper-2 p-4 space-y-2.5">
				<div className="flex items-center justify-between">
					<span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-2">
						{t("mcp.templatesTitle")}
					</span>
					<span className="font-mono text-[10px] text-ink-2/70">Model Context Protocol</span>
				</div>
				<div className="flex flex-wrap gap-2">
					{templates.map((tpl) => (
						<button
							key={tpl.id}
							type="button"
							onClick={() => onSelectTemplate(tpl)}
							className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink hover:border-accent hover:text-accent transition shadow-2xs cursor-pointer"
						>
							<Plus className="size-3 text-accent" />
							<span className="font-medium">{tpl.name}</span>
							<span className="text-[10px] text-ink-2/60 uppercase">({tpl.transport})</span>
						</button>
					))}
				</div>
			</div>

			{/* Connected Servers List */}
			{servers.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white p-10 text-center space-y-3">
					<div className="flex size-12 items-center justify-center rounded-xl bg-paper-2 border border-line">
						<Server className="size-6 text-accent" />
					</div>
					<h3 className="font-sans text-base font-semibold text-ink">
						{t("mcp.noServers")}
					</h3>
					<p className="max-w-md text-xs text-ink-2 leading-relaxed">
						{t("mcp.noServersDesc")}
					</p>
					<Button onClick={onOpenAdd} size="sm" className="gap-1.5 font-mono text-xs">
						<Plus className="size-3.5" />
						{t("mcp.addServer")}
					</Button>
				</div>
			) : (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{servers.map((s) => {
						const isConnected = s.status === "connected";
						const isError = s.status === "error";

						return (
							<div
								key={s.id}
								className={`flex flex-col justify-between rounded-xl border bg-white p-4 shadow-xs transition ${
									!s.enabled ? "opacity-60 border-line" : isConnected ? "border-emerald-500/40 hover:border-emerald-500" : isError ? "border-red-500/40" : "border-line"
								}`}
							>
								<div className="space-y-3">
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<Badge className="font-mono text-[10px] uppercase">
													{s.transport}
												</Badge>
												<span className="font-mono text-[10px] text-ink-2">
													{s.toolsCount} tools
												</span>
											</div>
											<h4 className="mt-1.5 truncate font-sans text-sm font-semibold text-ink" title={s.name}>
												{s.name}
											</h4>
										</div>

										{/* Status Badge */}
										<span
											className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
												isConnected
													? "bg-[#f4faf5] border border-[#bcd9c0] text-[#1d7a33]"
													: isError
													? "bg-[#fdf2f2] border border-[#f5c2c7] text-[#c6293b]"
													: "bg-paper-2 border border-line text-ink-2"
											}`}
										>
											{isConnected ? (
												<CheckCircle2 className="size-3" />
											) : isError ? (
												<AlertTriangle className="size-3" />
											) : (
												<Activity className="size-3" />
											)}
											{s.status.toUpperCase()}
										</span>
									</div>

									{/* Target URL or Command */}
									<div className="rounded-lg bg-paper-2 p-2 font-mono text-[11px] text-ink-2 truncate">
										{s.transport === "stdio" ? (
											<span className="flex items-center gap-1.5">
												<Terminal className="size-3 text-accent shrink-0" />
												<span className="truncate">{s.command} {s.args ? JSON.parse(s.args).join(" ") : ""}</span>
											</span>
										) : (
											<span className="flex items-center gap-1.5">
												<Globe className="size-3 text-accent shrink-0" />
												<span className="truncate">{s.url}</span>
											</span>
										)}
									</div>
								</div>

								{/* Card Actions */}
								<div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
									<button
										type="button"
										onClick={() => onToggle(s.id, !s.enabled)}
										className={`font-mono text-[11px] font-medium cursor-pointer ${
											s.enabled ? "text-accent hover:underline" : "text-ink-2 hover:text-ink"
										}`}
									>
										{s.enabled ? t("common.enabled") : t("common.disabled")}
									</button>

									<div className="flex items-center gap-1.5">
										<Button
											size="sm"
											variant="outline"
											className="h-7 px-2 font-mono text-[10.5px] gap-1"
											onClick={() => onPing(s.id)}
											disabled={pingingId === s.id}
										>
											<RefreshCw className={`size-3 ${pingingId === s.id ? "animate-spin" : ""}`} />
											Test
										</Button>
										<Button
											size="sm"
											variant="ghost"
											className="h-7 w-7 p-0 text-ink-2 hover:text-[#c6293b]"
											onClick={() => onDelete(s.id)}
										>
											<Trash2 className="size-3.5" />
										</Button>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
