import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "@web/lib/api";
import { Bot, Brain, Sparkles, Zap, X } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { SkillsDialog, SkillIcon } from "./skills-dialog";
import { ContextPillPopover } from "./context-popover";
import { HARNESS_SKILLS, THINKING_LEVELS, getModelThinkingLevels, type ThinkingLevel, type ThinkingOption, type HarnessSkill } from "@shared/skills";
import type { ModelItem } from "./thread-sidebar";
import type { ThreadTokensInfo } from "@web/lib/chat-tokens";
import { fmtCompact } from "@web/lib/utils";
import { groupModelsByProvider } from "./model-selector-utils";
interface ChatToolbarProps {
	selectedModel: string;
	onSelectModel: (model: string) => void;
	models: ModelItem[];
	thinkingLevel: ThinkingLevel;
	onSelectThinking: (level: ThinkingLevel) => void;
	selectedSkills: string[];
	onToggleSkill: (skillId: string) => void;
	demoQuota?: { budget: number | null; used: number };
	tokensInfo?: ThreadTokensInfo;
	onOpenCompact?: () => void;
}
export function ChatToolbar({
	selectedModel,
	onSelectModel,
	models,
	thinkingLevel,
	onSelectThinking,
	selectedSkills,
	onToggleSkill,
	demoQuota,
	tokensInfo,
	onOpenCompact,
}: ChatToolbarProps) {
	const { t, i18n } = useTranslation();
	const [skillsOpen, setSkillsOpen] = useState(false);

	// Allow all models in chat including Kiro
	const filteredModels = models.filter((m) => (m.provider ? m.provider !== "grok" : true));
	const curModel = models.find((m) => m.id === selectedModel);
	const availableLevels = useMemo(() => getModelThinkingLevels(selectedModel, curModel?.provider), [selectedModel, curModel]);
	const visibleThinkingOptions = useMemo(() => THINKING_LEVELS.filter((tl) => availableLevels.includes(tl.id)), [availableLevels]);
	useEffect(() => {
		if (!availableLevels.includes(thinkingLevel)) {
			onSelectThinking(availableLevels.includes("high") ? "high" : availableLevels[0] || "off");
		}
	}, [availableLevels, thinkingLevel, onSelectThinking]);

	const groupedModels = useMemo(() => groupModelsByProvider(filteredModels), [filteredModels]);
	const { data: skillsQueryData } = useQuery({ queryKey: ["custom-skills"], queryFn: () => api<{ builtInSkills: HarnessSkill[]; customSkills: { id: string; name: string; slug: string; description: string; icon: string; enabled: boolean }[] }>("/api/skills") });
	const customSkills = skillsQueryData?.customSkills ?? [];
	const allAvailableSkills = useMemo(() => {
		const custom = customSkills.filter((cs) => cs.enabled).map((cs) => ({ id: cs.id, name: cs.name, shortName: cs.slug || cs.name, icon: "Sparkles" as const, description: cs.description || "", prompt: "" }));
		return [...HARNESS_SKILLS, ...custom];
	}, [customSkills]);
	const activeSkillObjects = allAvailableSkills.filter((s) => selectedSkills.includes(s.id));
	const { data: usageData } = useQuery({ queryKey: ["usage", "sidebar"], queryFn: () => api<{ creditBudget: number | null; usedCreditsThisWeek?: number }>("/api/me/usage"), refetchInterval: 30_000, enabled: !demoQuota });
	const budget = demoQuota !== undefined ? demoQuota.budget : (usageData?.creditBudget ?? null);
	const used = demoQuota !== undefined ? demoQuota.used : Math.round(usageData?.usedCreditsThisWeek ?? 0);
	const remaining = budget != null ? Math.max(0, budget - used) : null;
	const pct = budget != null && budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;
	const daysToReset = ((1 - new Date().getDay() + 7) % 7) || 7;
	return (
		<div className="space-y-2">
			{/* Quota Status Row */}
			<div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 px-1 font-mono text-[11px] text-ink-2">
				<div className="flex items-center gap-2">
					<span className="text-[10px] uppercase tracking-wider text-ink-2/70 font-semibold">Quota:</span>
					{budget == null ? (
						<span className="inline-flex items-center gap-1 rounded bg-paper-2 px-2 py-0.5 font-medium text-accent border border-line">&infin; {t("chat.unlimitedWeekly")}</span>
					) : (
						<div className="flex flex-wrap items-center gap-2">
							<span className={`font-semibold ${pct >= 100 ? "text-[#c6293b]" : pct >= 80 ? "text-[#9a6b0a]" : "text-ink"}`}>{pct}%</span>
							<div className="h-1.5 w-20 sm:w-28 overflow-hidden rounded-full bg-paper-2 border border-line/50">
								<div className={`h-full rounded-full transition-all duration-300 ${pct >= 100 ? "bg-[#c6293b]" : pct >= 80 ? "bg-[#e8b548]" : "bg-accent"}`} style={{ width: `${Math.min(100, pct)}%` }} />
							</div>
							<span><span className="font-semibold text-ink">{used.toLocaleString()}</span> / {budget.toLocaleString()} cr</span>
							<span className="text-ink-2/60">({t("chat.creditsRemaining", { count: remaining?.toLocaleString() })})</span>
						</div>
					)}
				</div>
				<div className="flex items-center gap-3">
					{tokensInfo && (
						<ContextPillPopover
							tokensInfo={tokensInfo}
							onOpenCompact={onOpenCompact}
							isVi={i18n.language?.startsWith("vi")}
						/>
					)}
					{budget != null && <span className="text-[10px] text-ink-2/60">{t("chat.resetCountdown", { days: daysToReset })}</span>}
				</div>
			</div>

			{/* Main Toolbar Controls */}
			<div className="mx-auto flex w-full max-w-4xl items-center gap-2 px-1 text-xs">
				{/* Fixed Left Controls: Model, Thinking, Agent Skills */}
				<div className="flex shrink-0 items-center gap-2">
					{/* 1. Model Selector at bottom */}
					<div className="flex items-center gap-1">
						<Select value={selectedModel} onValueChange={onSelectModel}>
							<SelectTrigger className="h-7 border-line bg-white font-mono text-xs gap-1.5 px-2.5 shadow-2xs hover:border-accent cursor-pointer max-w-[260px] truncate overflow-hidden">
								<Bot className="size-3.5 text-accent shrink-0" />
								<span className="truncate">{curModel?.displayName || selectedModel}</span>
							</SelectTrigger>
							<SelectContent className="max-h-[380px] w-[340px] sm:w-[420px] overflow-y-auto p-1">
								{groupedModels.map((g) => (
									<SelectGroup key={g.provider}>
										<SelectLabel className="flex items-center justify-between text-[10px] font-mono font-bold tracking-wider">
											<span>{g.name}</span>
											<span className="text-ink-2/60 text-[9px] font-normal font-mono">{g.models.length} models</span>
										</SelectLabel>
										{g.models.map((m) => {
											const isFree = (m.priceIn ?? 0) === 0 && (m.priceOut ?? 0) === 0;
											const cachePrice = m.priceCacheRead ?? Math.round((m.priceIn ?? 0) * 0.1);
											return (
												<SelectItem key={m.id} value={m.id} className="py-2 pr-3 my-0.5 rounded-sm">
													<div className="flex flex-col gap-1 min-w-[270px] text-left">
														<div className="flex items-center justify-between gap-2">
															<span className="font-mono text-xs font-semibold text-ink truncate">{m.displayName || m.id}</span>
															<div className="flex items-center gap-1.5 shrink-0">
																<span className="rounded bg-accent/10 border border-accent/25 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-accent">{fmtCompact(m.contextWindow || 200_000)}</span>
																<span className="rounded bg-paper-2 border border-line px-1.5 py-0.2 font-mono text-[9px] uppercase text-ink-2">{m.provider}</span>
															</div>
														</div>
														<div className="flex items-center gap-1.5 font-mono text-[10px] text-ink-2">
															{isFree ? <span className="font-semibold text-[#1d7a33]">Free (0 cr)</span> : (
																<span>In: <strong className="text-ink font-semibold">{m.priceIn ?? 0}</strong> &middot; Out: <strong className="text-ink font-semibold">{m.priceOut ?? 0}</strong> &middot; Cache: <strong className="text-ink font-semibold">{cachePrice}</strong> cr/1M</span>
															)}
														</div>
													</div>
												</SelectItem>
											);
										})}
									</SelectGroup>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* 2. Thinking Level Selector */}
					<div className="flex items-center gap-1">
						<Select value={thinkingLevel} onValueChange={(val) => onSelectThinking(val as ThinkingLevel)}>
							<SelectTrigger className={`h-7 border-line font-mono text-xs gap-1.5 px-2.5 shadow-2xs cursor-pointer transition ${thinkingLevel !== "off" ? "bg-[#f6f8ff] border-[#d5daff] text-[#2323e6] font-medium" : "bg-white text-ink"}`}>
								<Brain className={`size-3.5 shrink-0 ${thinkingLevel !== "off" ? "text-accent" : "text-ink-2"}`} />
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{visibleThinkingOptions.map((tl: ThinkingOption) => (
									<SelectItem key={tl.id} value={tl.id} className="font-mono text-xs">
										{tl.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					{/* 3. Harness Skills Toggle Button */}
					<button
						type="button"
						onClick={() => setSkillsOpen(true)}
						className={`flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 font-mono text-xs shadow-2xs transition cursor-pointer ${
							selectedSkills.length > 0 ? "border-accent bg-accent text-white font-medium" : "border-line bg-white text-ink-2 hover:text-ink hover:border-ink-2"
						}`}
						title="Harness Agent Skills"
					>
						<Zap className="size-3.5" />
						<span>Agent Skills ({selectedSkills.length})</span>
					</button>
				</div>

				{/* 4. Active Skill Chips: Horizontally scrollable track right next to buttons */}
				{activeSkillObjects.length > 0 && (
					<div className="flex-1 min-w-0 overflow-x-auto py-0.5" style={{ scrollbarWidth: "none" }}>
						<div className="flex items-center gap-1.5 w-max pr-1">
							{activeSkillObjects.map((s) => (
								<div key={s.id} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#d5daff] bg-[#f6f8ff] px-2 py-0.5 font-mono text-[10.5px] text-[#2323e6] shadow-2xs">
									<SkillIcon icon={s.icon} className="size-3" />
									<span className="font-medium">{s.shortName}</span>
									<button type="button" onClick={() => onToggleSkill(s.id)} className="hover:text-[#c6293b] cursor-pointer"><X className="size-3" /></button>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
			<SkillsDialog open={skillsOpen} onOpenChange={setSkillsOpen} selectedSkills={selectedSkills} onToggleSkill={onToggleSkill} customSkills={customSkills} />
		</div>
	);
}
