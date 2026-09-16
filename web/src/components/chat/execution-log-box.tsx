import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
	Brain,
	CheckCircle2,
	ChevronDown,
	Clock,
	FileText,
	Globe,
	Loader2,
	Zap,
} from "lucide-react";
import { HARNESS_SKILLS, type HarnessSkill } from "@shared/skills";
import { SearchSourcesList } from "./search-sources-list";
import type { ExecutionStep, SearchData } from "./execution-types";

interface ExecutionLogBoxProps {
	thinking?: string;
	isStreaming?: boolean;
	skills?: string[];
	fileIds?: string[];
	filesMap?: Record<string, { id: string; filename: string; sizeBytes: number }>;
	searches?: SearchData[];
	steps?: ExecutionStep[];
	latencyMs?: number;
}

export function ExecutionLogBox({
	thinking,
	isStreaming = false,
	skills = [],
	fileIds = [],
	filesMap = {},
	searches = [],
	steps = [],
	latencyMs,
}: ExecutionLogBoxProps) {
	const { t, i18n } = useTranslation();
	const isVi = i18n.language?.startsWith("vi");
	const hasThinking = Boolean(thinking);
	const hasSkills = skills && skills.length > 0;
	const hasFiles = fileIds && fileIds.length > 0;
	const hasSearches = searches && searches.length > 0;
	const hasSteps = steps && steps.length > 0;

	const [isOpen, setIsOpen] = useState(isStreaming || hasThinking || hasSearches);

	if (!hasThinking && !hasSkills && !hasFiles && !hasSearches && !hasSteps && !isStreaming) {
		return null;
	}

	const activeSkills = HARNESS_SKILLS.filter((s) => skills.includes(s.id));
	const totalSources = searches.reduce((acc, s) => acc + (s.sources?.length || s.count || 0), 0);

	return (
		<div className="space-y-2 pb-2">
			<div className="overflow-hidden rounded-md border border-line bg-paper-2 text-xs shadow-2xs transition">
				{/* Toggle Header */}
				<button
					type="button"
					onClick={() => setIsOpen(!isOpen)}
					className="flex w-full items-center justify-between px-3 py-2 text-left font-mono text-[11px] text-ink-2 hover:bg-paper hover:text-ink cursor-pointer transition select-none"
				>
					<div className="flex flex-wrap items-center gap-2 min-w-0">
						<div className="flex items-center gap-1.5">
							{isStreaming ? (
								<Loader2 className="size-3.5 text-accent animate-spin shrink-0" />
							) : (
								<Brain className="size-3.5 text-accent shrink-0" />
							)}
							<span className="font-semibold text-ink">
								{isStreaming ? t("chat.execStreaming") : t("chat.execTitle")}
							</span>
						</div>

						{hasSearches && (
							<span className="inline-flex items-center gap-1 rounded bg-[#f0f4ff] px-1.5 py-0.5 text-[10px] text-[#2323e6] border border-[#d5daff]">
								<Globe className="size-2.5" />
								{t("chat.webSourcesCount", { count: totalSources })}
							</span>
						)}
						{activeSkills.length > 0 && (
							<span className="inline-flex items-center gap-1 rounded bg-[#f6f8ff] px-1.5 py-0.5 text-[10px] text-[#2323e6] border border-[#d5daff]">
								<Zap className="size-2.5" />
								{t("chat.skillsCount", { count: activeSkills.length })}
							</span>
						)}
						{latencyMs !== undefined && latencyMs > 0 && (
							<span className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[10px] text-ink-2 border border-line shadow-2xs">
								<Clock className="size-2.5 text-accent" />
								{(latencyMs / 1000).toFixed(1)}s
							</span>
						)}
					</div>

					<div className="flex items-center gap-1 text-ink-2 shrink-0 ml-2">
						<span className="text-[10px]">{isOpen ? t("chat.collapse") : t("chat.details")}</span>
						<ChevronDown className={`size-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
					</div>
				</button>

				{/* Animated Expand/Collapse Panel */}
				<AnimatePresence initial={false}>
					{isOpen && (
						<motion.div
							key="execution-panel"
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
							className="overflow-hidden border-t border-line/60 bg-white"
						>
							<div className="p-3 space-y-3 font-mono text-[11px]">
								{/* Step Timeline */}
								{hasSteps && (
									<div className="space-y-1.5">
										<div className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">
											{t("chat.stepsTitle")}
										</div>
										<div className="space-y-1">
											{steps.map((st, i) => (
												<div key={st.id || i} className="flex items-start gap-2 text-ink">
													{st.status === "running" ? (
														<Loader2 className="size-3 text-accent animate-spin mt-0.5 shrink-0" />
													) : (
														<CheckCircle2 className="size-3 text-[#1d7a33] mt-0.5 shrink-0" />
													)}
													<span className="leading-snug">
														{isVi ? (st.labelVi || st.label) : (st.label || st.labelVi)}
													</span>
												</div>
											))}
										</div>
									</div>
								)}

								{/* Web Searches & Sources */}
								<SearchSourcesList searches={searches} />

								{/* Skills & Attached Files Chips */}
								{(hasSkills || hasFiles) && (
									<div className="space-y-1.5 border-t border-line/40 pt-2.5">
										<div className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">
											{t("chat.skillsFilesTitle")}
										</div>
										<div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
											{activeSkills.map((s) => (
												<span key={s.id} className="inline-flex items-center gap-1 rounded bg-[#f6f8ff] border border-[#d5daff] px-2 py-0.5 text-[#2323e6]">
													<Zap className="size-3" />
													{t("chat.skillLabel")} {s.shortName}
												</span>
											))}
											{fileIds.map((fid) => (
												<span key={fid} className="inline-flex items-center gap-1 rounded bg-[#f4faf5] border border-[#bcd9c0] px-2 py-0.5 text-[#1d7a33]">
													<FileText className="size-3" />
													{t("chat.fileLabel")} {filesMap[fid]?.filename || "Attachment"}
												</span>
											))}
										</div>
									</div>
								)}

								{/* Thinking / Reasoning Stream */}
								{hasThinking && (
									<div className="space-y-1.5 border-t border-line/40 pt-2.5">
										<div className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">
											{t("chat.reasoningTitle")}
										</div>
										<div className="rounded bg-paper p-2.5 leading-relaxed text-ink-2 whitespace-pre-wrap max-h-60 overflow-y-auto font-mono text-[10.5px]">
											{thinking}
										</div>
									</div>
								)}
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}
