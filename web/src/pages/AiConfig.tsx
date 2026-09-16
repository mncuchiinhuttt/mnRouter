import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Globe } from "lucide-react";
import { api } from "@web/lib/api";
import { Badge, Input } from "@web/components/ui/primitives";
import { SnippetCard } from "@web/components/snippet-card";
import { ZCodeCopyCard } from "@web/components/zcode-copy-card";
import { ModelDirectoryView } from "@web/components/model-directory-view";
import { HARNESSES } from "@web/lib/ai-harness-configs";
import type { ModelItem } from "@web/components/chat/thread-sidebar";

interface KeysResp {
	keys: { id: string; name: string; prefix: string; active: boolean }[];
}

export default function AiConfig() {
	const { t, i18n } = useTranslation();
	const isVi = i18n.language?.startsWith("vi");

	const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:8787";
	const [apiKey, setApiKey] = useState("");
	const [os, setOs] = useState<"mac" | "win">("mac");
	const [selectedHarnessId, setSelectedHarnessId] = useState("claude-code");
	const [activeTab, setActiveTab] = useState<"tools" | "models">("tools");
	const { data: modelsData } = useQuery({ queryKey: ["chat-models"], queryFn: () => api<{ models: ModelItem[] }>("/api/chat/models") });
	const models = modelsData?.models ?? [];

	const effectiveKey = apiKey.trim() || "mr_YOUR_API_KEY";
	const currentHarness = HARNESSES.find((h) => h.id === selectedHarnessId) ?? HARNESSES[0]!;
	const setupCmd =
		os === "mac"
			? `curl -fsSL "${baseUrl}/setup.sh?tool=${currentHarness.id}&key=${effectiveKey}" | bash`
			: `irm "${baseUrl}/setup.ps1?tool=${currentHarness.id}&key=${effectiveKey}" | iex`;

	const resetCmd =
		os === "mac"
			? `curl -fsSL "${baseUrl}/reset.sh?tool=${currentHarness.id}" | bash`
			: `irm "${baseUrl}/reset.ps1?tool=${currentHarness.id}" | iex`;

	return (
		<div className="space-y-6">
			<header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-4xl font-semibold leading-none tracking-tight sm:text-[44px]">{t("aiConfig.title")}</h1>
					<p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-[15px]">{t("aiConfig.desc")}</p>
				</div>
			</header>

			{/* API Key input & Gateway URL bar */}
			<div className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-xs md:flex-row md:items-center md:justify-between">
				<div className="flex flex-1 flex-wrap items-center gap-2 sm:gap-3">
					<div className="flex items-center gap-1.5 font-mono text-xs font-medium text-ink shrink-0">
						<KeyRound className="size-3.5 text-accent" />
						<span>{t("aiConfig.apiKey")}:</span>
					</div>
					<Input
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						placeholder="mr_..."
						className="h-8 w-full max-w-sm font-mono text-xs"
					/>
				</div>

				<div className="flex items-center gap-2 text-xs text-ink-2 shrink-0">
					<Globe className="size-3.5" />
					<span>Gateway:</span>
					<code className="rounded-xs bg-paper-2 px-1.5 py-0.5 font-mono text-[11px] text-ink">{baseUrl}</code>
					<Badge className="border-[#bcd9c0] text-[#1d7a33]">AUTO-DETECTED</Badge>
				</div>
			</div>
			{/* Main Tabs Navigation */}
			<div className="flex items-center gap-1 border-b border-line">
				<button
					type="button"
					onClick={() => setActiveTab("tools")}
					className={`border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition cursor-pointer ${
						activeTab === "tools" ? "border-accent text-accent font-semibold" : "border-transparent text-ink-2 hover:text-ink"
					}`}
				>
					{t("aiConfig.tabTools")}
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("models")}
					className={`border-b-2 px-4 py-2 font-mono text-xs uppercase tracking-wider transition cursor-pointer ${
						activeTab === "models" ? "border-accent text-accent font-semibold" : "border-transparent text-ink-2 hover:text-ink"
					}`}
				>
					{t("aiConfig.tabModels")} ({models.length})
				</button>
			</div>

			{activeTab === "tools" ? (
				<div className="grid gap-6 lg:grid-cols-[250px_1fr]">
					{/* Harness List with Logos */}
					<div className="flex flex-row overflow-x-auto gap-1 pb-2 lg:flex-col lg:overflow-x-visible lg:pb-0">
						{HARNESSES.map((h) => {
							const active = h.id === currentHarness.id;
							return (
								<button
									key={h.id}
									onClick={() => setSelectedHarnessId(h.id)}
									className={`flex items-center justify-between gap-2.5 rounded-md border px-3 py-2 text-left font-mono text-xs transition-all cursor-pointer whitespace-nowrap lg:whitespace-normal ${
										active ? "border-accent bg-accent text-white font-medium shadow-xs" : "border-line bg-white text-ink hover:border-line-hover hover:bg-paper-2/60"
									}`}
								>
									<div className="flex items-center gap-2.5 min-w-0">
										<div className="flex size-5 shrink-0 items-center justify-center rounded-xs bg-white/10 p-0.5">
											<img src={h.icon} alt="" className="size-4 object-contain rounded-xs" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }} />
										</div>
										<span className="truncate">{h.name}</span>
									</div>
									<span className={`text-[10px] uppercase opacity-80 ${active ? "text-white" : "text-ink-2"}`}>{h.protocol.split(" ")[0]}</span>
								</button>
							);
						})}
					</div>

					{/* Active Harness Config Details */}
					<div className="space-y-4">
						{/* Agent Header & OS Toggle */}
						<div className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
							<div className="flex items-center gap-3 min-w-0 flex-1">
								<div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-paper-2 p-1">
									<img src={currentHarness.icon} alt={currentHarness.name} className="size-6 object-contain" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }} />
								</div>
								<div className="min-w-0 flex-1">
									<h2 className="text-lg font-semibold tracking-tight text-ink">{currentHarness.name}</h2>
									<p className="text-xs text-ink-2 truncate">{isVi ? currentHarness.descVi : currentHarness.descEn}</p>
								</div>
							</div>
							<div className="flex items-center gap-2 shrink-0">
								<div className="inline-flex rounded-md border border-line bg-paper-2 p-0.5 font-mono text-xs">
									<button onClick={() => setOs("mac")} className={`rounded px-2.5 py-1 transition cursor-pointer ${os === "mac" ? "bg-accent text-white font-medium" : "text-ink-2 hover:text-ink"}`}>macOS / Linux</button>
									<button onClick={() => setOs("win")} className={`rounded px-2.5 py-1 transition cursor-pointer ${os === "win" ? "bg-accent text-white font-medium" : "text-ink-2 hover:text-ink"}`}>Windows (PowerShell)</button>
								</div>
								<Badge className="border-accent text-accent font-mono uppercase text-[10.5px]">{currentHarness.badge}</Badge>
							</div>
						</div>

						{currentHarness.id === "zcode" ? (
							<ZCodeCopyCard baseUrl={baseUrl} apiKey={effectiveKey} />
						) : (
							<div className="space-y-4">
								<SnippetCard
									title={`${t("aiConfig.oneLineSetup")} (${currentHarness.name})`}
									subtitle={t("aiConfig.setupSubtitle")}
									badge={os === "mac" ? "CURL | BASH" : "POWERSHELL"}
									code={setupCmd}
								/>
								<SnippetCard
									title={`${t("aiConfig.oneLineReset")} (${currentHarness.name})`}
									subtitle={t("aiConfig.resetSubtitle")}
									badge={os === "mac" ? "CURL | BASH" : "POWERSHELL"}
									code={resetCmd}
								/>
							</div>
						)}
					</div>
				</div>
			) : (
				<ModelDirectoryView models={models} />
			)}
		</div>
	);
}
