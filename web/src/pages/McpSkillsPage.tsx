import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Boxes, Plus, RefreshCw } from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { McpSummaryCards } from "@web/components/mcp/mcp-summary-cards";
import { McpServerList, type McpServerItem } from "@web/components/mcp/mcp-server-list";
import { McpAddDialog } from "@web/components/mcp/mcp-add-dialog";
import { CustomSkillsList, type CustomSkillItem } from "@web/components/mcp/custom-skills-list";
import { AddSkillDialog } from "@web/components/mcp/add-skill-dialog";
import type { McpTemplate } from "../../../src/server/services/mcp.service";

export default function McpSkillsPage() {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const [activeTab, setActiveTab] = useState<"mcp" | "skills">("mcp");
	const [addMcpOpen, setAddMcpOpen] = useState(false);
	const [selectedTemplate, setSelectedTemplate] = useState<McpTemplate | null>(null);
	const [addSkillOpen, setAddSkillOpen] = useState(false);
	const [pingingId, setPingingId] = useState<string | null>(null);

	const { data: mcpData, refetch: refetchMcp } = useQuery({
		queryKey: ["mcp-servers"],
		queryFn: () => api<{ servers: McpServerItem[]; templates: McpTemplate[] }>("/api/mcp/servers"),
	});

	const { data: skillsData, refetch: refetchSkills } = useQuery({
		queryKey: ["custom-skills"],
		queryFn: () => api<{ builtInSkills: any[]; customSkills: CustomSkillItem[] }>("/api/skills"),
	});

	const servers = mcpData?.servers ?? [], templates = mcpData?.templates ?? [], customSkills = skillsData?.customSkills ?? [];

	const createMcp = useMutation({
		mutationFn: (body: any) => apiJson("/api/mcp/servers", "POST", body),
		onSuccess: () => { qc.invalidateQueries({ queryKey: ["mcp-servers"] }); setAddMcpOpen(false); toast.success(t("mcp.serverAdded")); },
		onError: (e) => toast.error((e as Error).message),
	});

	const toggleMcp = useMutation({
		mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => apiJson(`/api/mcp/servers/${id}`, "PATCH", { enabled }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["mcp-servers"] }),
	});

	const deleteMcp = useMutation({
		mutationFn: (id: string) => apiJson(`/api/mcp/servers/${id}`, "DELETE", {}),
		onSuccess: () => { qc.invalidateQueries({ queryKey: ["mcp-servers"] }); toast.success(t("mcp.serverDeleted")); },
	});

	const pingMcp = async (id: string) => {
		setPingingId(id);
		try {
			const res = await apiJson<{ result: { success: boolean; toolsCount: number; error?: string } }>(`/api/mcp/servers/${id}/ping`, "POST", {});
			qc.invalidateQueries({ queryKey: ["mcp-servers"] });
			if (res.result.success) toast.success(`${t("mcp.pingSuccess")} (${res.result.toolsCount} ${t("mcp.toolsCount")}).`);
			else toast.error(`${t("mcp.pingFailed")}: ${res.result.error}`);
		} catch (e) { toast.error((e as Error).message); } finally { setPingingId(null); }
	};

	const createSkill = useMutation({
		mutationFn: (body: any) => apiJson("/api/skills", "POST", body),
		onSuccess: () => { qc.invalidateQueries({ queryKey: ["custom-skills"] }); setAddSkillOpen(false); toast.success(t("skills.skillSaved")); },
		onError: (e) => toast.error((e as Error).message),
	});

	const toggleSkill = useMutation({
		mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => apiJson(`/api/skills/${id}`, "PATCH", { enabled }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-skills"] }),
	});

	const deleteSkill = useMutation({
		mutationFn: (id: string) => apiJson(`/api/skills/${id}`, "DELETE", {}),
		onSuccess: () => { qc.invalidateQueries({ queryKey: ["custom-skills"] }); toast.success(t("skills.skillDeleted")); },
	});

	const totalTools = servers.reduce((acc, s) => acc + (s.enabled ? s.toolsCount : 0), 0);

	return (
		<div className="space-y-6">
			{/* Header */}
			<header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<Boxes className="size-6 text-accent" />
						<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("mcp.title")}</h1>
					</div>
					<p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">{t("mcp.desc")}</p>
				</div>

				<div className="flex items-center gap-2">
					<Button size="sm" variant="outline" className="h-8 gap-1.5 font-mono text-xs" onClick={() => { refetchMcp(); refetchSkills(); }}>
						<RefreshCw className="size-3.5" /><span>{t("common.refresh")}</span>
					</Button>
					{activeTab === "mcp" ? (
						<Button size="sm" className="h-8 gap-1.5 font-mono text-xs" onClick={() => { setSelectedTemplate(null); setAddMcpOpen(true); }}>
							<Plus className="size-3.5" /><span>{t("mcp.addServer")}</span>
						</Button>
					) : (
						<Button size="sm" className="h-8 gap-1.5 font-mono text-xs" onClick={() => setAddSkillOpen(true)}>
							<Plus className="size-3.5" /><span>{t("skills.addSkill")}</span>
						</Button>
					)}
				</div>
			</header>

			{/* Metric Summary Cards */}
			<McpSummaryCards
				serversCount={servers.length}
				activeServersCount={servers.filter((s) => s.enabled).length}
				totalTools={totalTools}
				customSkillsCount={customSkills.length}
				activeCustomSkillsCount={customSkills.filter((s) => s.enabled).length}
				builtInCount={12}
			/>

			{/* Main Tabs Navigation */}
			<div className="flex items-center gap-1 border-b border-line">
				<button type="button" onClick={() => setActiveTab("mcp")} className={`border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition cursor-pointer ${activeTab === "mcp" ? "border-accent text-accent font-semibold" : "border-transparent text-ink-2 hover:text-ink"}`}>
					{t("mcp.tabServers")} ({servers.length})
				</button>
				<button type="button" onClick={() => setActiveTab("skills")} className={`border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition cursor-pointer ${activeTab === "skills" ? "border-accent text-accent font-semibold" : "border-transparent text-ink-2 hover:text-ink"}`}>
					{t("mcp.tabSkills")} ({customSkills.length})
				</button>
			</div>

			{/* Tab Content */}
			{activeTab === "mcp" ? (
				<McpServerList
					servers={servers}
					templates={templates}
					onSelectTemplate={(tpl) => { setSelectedTemplate(tpl); setAddMcpOpen(true); }}
					onPing={pingMcp}
					onToggle={(id, enabled) => toggleMcp.mutate({ id, enabled })}
					onDelete={(id) => deleteMcp.mutate(id)}
					onOpenAdd={() => { setSelectedTemplate(null); setAddMcpOpen(true); }}
					pingingId={pingingId}
				/>
			) : (
				<CustomSkillsList
					skills={customSkills}
					onToggle={(id, enabled) => toggleSkill.mutate({ id, enabled })}
					onDelete={(id) => deleteSkill.mutate(id)}
					onOpenAdd={() => setAddSkillOpen(true)}
				/>
			)}

			<McpAddDialog open={addMcpOpen} onOpenChange={setAddMcpOpen} template={selectedTemplate} onSubmit={(data) => createMcp.mutate(data)} loading={createMcp.isPending} />
			<AddSkillDialog open={addSkillOpen} onOpenChange={setAddSkillOpen} onSubmit={(data) => createSkill.mutate(data)} loading={createSkill.isPending} />
		</div>
	);
}
