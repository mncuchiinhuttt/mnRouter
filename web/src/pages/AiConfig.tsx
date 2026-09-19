import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Globe } from "lucide-react";
import { api } from "@web/lib/api";
import { Badge, Input } from "@web/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { SnippetCard } from "@web/components/snippet-card";
import { ZCodeCopyCard } from "@web/components/zcode-copy-card";
import { CopilotExtensionCard } from "@web/components/copilot-extension-card";
import { ModelDirectoryView } from "@web/components/model-directory-view";
import { HARNESSES } from "@web/lib/ai-harness-configs";
import type { ModelItem } from "@web/components/chat/thread-sidebar";

interface KeysResp {
	keys: { id: string; name: string; prefix: string; active: boolean }[];
}
function detectUserOS(): "mac" | "win" {
	if (typeof window === "undefined" || typeof navigator === "undefined") return "mac";
	const platform = (navigator as any).userAgentData?.platform || navigator.platform || "";
	const ua = navigator.userAgent || "";
	if (/win/i.test(platform) || /windows/i.test(ua)) {
		return "win";
	}
	return "mac";
}

export default function AiConfig() {
	const { t, i18n } = useTranslation();
	const isVi = i18n.language?.startsWith("vi");

	const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:8787";
	const [apiKey, setApiKey] = useState("");
	const [os, setOs] = useState<"mac" | "win">(() => detectUserOS());

	useEffect(() => {
		setOs(detectUserOS());
	}, []);
	const [selectedHarnessId, setSelectedHarnessId] = useState("claude-code");
	const [activeTab, setActiveTab] = useState<"tools" | "models">("tools");
	const [customSelectedModel, setCustomSelectedModel] = useState("gemini-3.8-flash");
	const [grokExploreModel, setGrokExploreModel] = useState("muse-spark-1.3-contributor-free");
	const [grokPlanModel, setGrokPlanModel] = useState("claude-sonnet-4-6-ag");
	const { data: modelsData } = useQuery({ queryKey: ["chat-models"], queryFn: () => api<{ models: ModelItem[] }>("/api/chat/models") });
	const models = modelsData?.models ?? [];

	const effectiveKey = apiKey.trim() || "mr_YOUR_API_KEY";
	const currentHarness = HARNESSES.find((h) => h.id === selectedHarnessId) ?? HARNESSES[0]!;
	let modelParam = "";
	if (currentHarness.id === "grok-build") {
		modelParam = `&model=${encodeURIComponent(customSelectedModel)}&explore_model=${encodeURIComponent(grokExploreModel)}&plan_model=${encodeURIComponent(grokPlanModel)}`;
	}
	const setupCmd =
		os === "mac"
			? `curl -fsSL "${baseUrl}/setup.sh?tool=${currentHarness.id}&key=${effectiveKey}${modelParam}" | bash`
			: `irm "${baseUrl}/setup.ps1?tool=${currentHarness.id}&key=${effectiveKey}${modelParam}" | iex`;

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
			<div className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
				<div className="flex flex-1 items-center gap-2 sm:gap-3 min-w-0">
					<div className="flex items-center gap-1.5 font-mono text-xs font-medium text-ink shrink-0">
						<KeyRound className="size-3.5 text-accent" />
						<span>{t("aiConfig.apiKey")}:</span>
					</div>
					<Input
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						placeholder="mr_..."
						className="h-8 flex-1 font-mono text-xs min-w-[240px] truncate"
					/>
				</div>
				<div className="flex items-center gap-2 text-xs text-ink-2 shrink-0">
					<Globe className="size-3.5" />
					<span>Gateway:</span>
					<code className="rounded-xs bg-paper-2 px-1.5 py-0.5 font-mono text-[11px] text-ink">{baseUrl}</code>
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
				<div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
					{/* Harness List with Logos */}
					<div data-tour="tool-tabs" className="flex flex-row overflow-x-auto gap-1 pb-2 lg:flex-col lg:overflow-x-visible lg:pb-0">
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
											<img src={h.icon} alt="" className={`size-4 object-contain rounded-xs ${h.id === "pi" ? (active ? "brightness-0 invert" : "brightness-0") : ""}`} onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }} />
										</div>
										<span className="truncate">{h.name}</span>
									</div>
									<span className={`text-[10px] uppercase opacity-80 ${active ? "text-white" : "text-ink-2"}`}>{h.protocol.split(" ")[0]}</span>
								</button>
							);
						})}
					</div>

					{/* Active Harness Config Details */}
					<div className="space-y-4 min-w-0">
						{/* Agent Header & OS Toggle */}
						<div className="flex flex-col gap-3 rounded-lg border border-line bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
							<div className="flex items-center gap-3 min-w-0 flex-1">
								<div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-paper-2 p-1">
									<img src={currentHarness.icon} alt={currentHarness.name} className={`size-6 object-contain ${currentHarness.id === "pi" ? "brightness-0" : ""}`} onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }} />
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

						{/* Multi-role Model Selectors for Grok Build */}
						{currentHarness.id === "grok-build" && (
							<div className="rounded-xl border border-line bg-paper/60 p-4 space-y-4 shadow-2xs">
								<div className="flex items-center justify-between border-b border-line pb-2.5">
									<div>
										<h3 className="font-mono text-xs font-semibold text-ink uppercase tracking-wider">
											{isVi ? "Cấu hình 3 Model Subagents cho Grok Build" : "Configure 3 Subagent Models for Grok Build"}
										</h3>
										<p className="text-[11px] text-ink-2 mt-0.5">
											{isVi
												? "Grok Build phân quyền 3 vai trò: Main (General), Explore (Đọc repo) và Plan (Lên kế hoạch)."
												: "Grok Build splits execution across 3 roles: General Main, Explore research, and Plan architect."}
										</p>
									</div>
								</div>

								<div className="grid gap-3.5 sm:grid-cols-3">
									{/* 1. Main / General-purpose */}
									<div className="space-y-1.5">
										<label className="text-[11px] font-mono font-semibold uppercase text-ink flex items-center justify-between">
											<span>1. Main / General</span>
											<span className="text-[10px] text-accent font-normal">Primary</span>
										</label>
										<Select value={customSelectedModel} onValueChange={setCustomSelectedModel}>
											<SelectTrigger className="h-9 font-mono text-xs bg-white border-line">
												<SelectValue placeholder="Select model..." />
											</SelectTrigger>
											<SelectContent className="max-h-64 font-mono text-xs">
												{models.map((m) => (
													<SelectItem key={m.id} value={m.id} className="text-xs">
														{m.id}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									{/* 2. Explore */}
									<div className="space-y-1.5">
										<label className="text-[11px] font-mono font-semibold uppercase text-ink flex items-center justify-between">
											<span>2. Explore</span>
											<span className="text-[10px] text-[#1d7a33] font-normal">Read-only</span>
										</label>
										<Select value={grokExploreModel} onValueChange={setGrokExploreModel}>
											<SelectTrigger className="h-9 font-mono text-xs bg-white border-line">
												<SelectValue placeholder="Select model..." />
											</SelectTrigger>
											<SelectContent className="max-h-64 font-mono text-xs">
												{models.map((m) => (
													<SelectItem key={m.id} value={m.id} className="text-xs">
														{m.id}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									{/* 3. Plan */}
									<div className="space-y-1.5">
										<label className="text-[11px] font-mono font-semibold uppercase text-ink flex items-center justify-between">
											<span>3. Plan</span>
											<span className="text-[10px] text-[#b45309] font-normal">Reasoning</span>
										</label>
										<Select value={grokPlanModel} onValueChange={setGrokPlanModel}>
											<SelectTrigger className="h-9 font-mono text-xs bg-white border-line">
												<SelectValue placeholder="Select model..." />
											</SelectTrigger>
											<SelectContent className="max-h-64 font-mono text-xs">
												{models.map((m) => (
													<SelectItem key={m.id} value={m.id} className="text-xs">
														{m.id}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
							</div>
						)}

						{currentHarness.id === "zcode" ? (
							<ZCodeCopyCard baseUrl={baseUrl} apiKey={effectiveKey} />
						) : currentHarness.id === "github-copilot" ? (
							<CopilotExtensionCard baseUrl={baseUrl} apiKey={effectiveKey} />
						) : (
							<div data-tour="copy-script-btn" className="space-y-4">
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
