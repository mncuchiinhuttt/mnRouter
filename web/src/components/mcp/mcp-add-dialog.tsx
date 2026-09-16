import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Input, Label } from "@web/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { Server, Plus } from "lucide-react";
import type { McpTemplate } from "../../../../src/server/services/mcp.service";

interface McpAddDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (data: {
		name: string;
		transport: "sse" | "http" | "stdio";
		url?: string;
		command?: string;
		args?: string[];
		env?: Record<string, string>;
	}) => void;
	template?: McpTemplate | null;
	loading?: boolean;
}

export function McpAddDialog({ open, onOpenChange, onSubmit, template, loading }: McpAddDialogProps) {
	const { t } = useTranslation();
	const [name, setName] = useState("");
	const [transport, setTransport] = useState<"sse" | "http" | "stdio">("sse");
	const [url, setUrl] = useState("");
	const [command, setCommand] = useState("");
	const [args, setArgs] = useState("");
	const [envJson, setEnvJson] = useState("");

	useEffect(() => {
		if (template) {
			setName(template.name);
			setTransport(template.transport);
			setUrl(template.url || "");
			setCommand(template.command || "");
			setArgs(template.args ? template.args.join(" ") : "");
			setEnvJson(template.envPlaceholder ? JSON.stringify(template.envPlaceholder, null, 2) : "");
		} else if (open) {
			setName("");
			setTransport("sse");
			setUrl("http://localhost:8000/sse");
			setCommand("");
			setArgs("");
			setEnvJson("");
		}
	}, [template, open]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;

		let parsedEnv: Record<string, string> | undefined;
		if (envJson.trim()) {
			try {
				parsedEnv = JSON.parse(envJson);
			} catch {}
		}

		onSubmit({
			name: name.trim(),
			transport,
			url: transport !== "stdio" ? url.trim() || undefined : undefined,
			command: transport === "stdio" ? command.trim() || undefined : undefined,
			args: transport === "stdio" && args.trim() ? args.trim().split(/\s+/) : undefined,
			env: parsedEnv,
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl sm:max-w-2xl">
				<form onSubmit={handleSubmit} className="space-y-5">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Server className="size-4 text-accent" />
							<span>{template ? `Connect ${template.name}` : t("mcp.addTitle")}</span>
						</DialogTitle>
						<DialogDescription>
							{t("mcp.addDesc")}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 font-mono text-xs">
						{/* Server Name & Transport in 2 columns */}
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div className="space-y-1">
								<Label className="text-[11px] uppercase tracking-wider text-ink-2">{t("mcp.serverName")} *</Label>
								<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="GitHub MCP Server" required className="h-8.5 font-sans" />
							</div>

							<div className="space-y-1">
								<Label className="text-[11px] uppercase tracking-wider text-ink-2">{t("mcp.transport")}</Label>
								<Select value={transport} onValueChange={(v) => setTransport(v as any)}>
									<SelectTrigger className="h-8.5 font-mono">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="sse">SSE (Server-Sent Events / HTTP)</SelectItem>
										<SelectItem value="http">Streamable HTTP</SelectItem>
										<SelectItem value="stdio">stdio (Local CLI Process)</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* URL or Command */}
						{transport !== "stdio" ? (
							<div className="space-y-1">
								<Label className="text-[11px] uppercase tracking-wider text-ink-2">{t("mcp.serverUrl")} *</Label>
								<Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:8000/sse" required className="h-8.5" />
							</div>
						) : (
							<div className="space-y-2">
								<div className="space-y-1">
									<Label className="text-[11px] uppercase tracking-wider text-ink-2">{t("mcp.command")} *</Label>
									<Input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx" required className="h-8.5" />
								</div>
								<div className="space-y-1">
									<Label className="text-[11px] uppercase tracking-wider text-ink-2">{t("mcp.arguments")}</Label>
									<Input value={args} onChange={(e) => setArgs(e.target.value)} placeholder="-y @modelcontextprotocol/server-filesystem /path" className="h-8.5" />
								</div>
							</div>
						)}

						{/* Environment variables / Headers */}
						<div className="space-y-1.5">
							<div className="flex items-center justify-between">
								<Label className="text-[11px] uppercase tracking-wider text-ink-2">{t("mcp.headersEnv")}</Label>
								<span className="text-[10px] text-ink-2/60">JSON key-value map</span>
							</div>
							<textarea
								value={envJson}
								onChange={(e) => setEnvJson(e.target.value)}
								placeholder='{&#10;  "Authorization": "Bearer your_token",&#10;  "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."&#10;}'
								rows={6}
								className="w-full rounded-md border border-line bg-paper p-3 font-mono text-xs focus:outline-none focus:border-accent leading-relaxed"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							{t("mcp.cancel")}
						</Button>
						<Button type="submit" disabled={loading} className="gap-1.5 font-mono text-xs">
							<Plus className="size-3.5" />
							{loading ? t("mcp.connectingBtn") : t("mcp.connectBtn")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
