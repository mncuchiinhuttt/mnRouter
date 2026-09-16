import { useState } from "react";
import { Brain, ChevronDown, FileText, Sparkles, Zap } from "lucide-react";
import { HARNESS_SKILLS } from "@shared/skills";

interface ThinkingBoxProps {
	thinking?: string;
	isStreamingThinking?: boolean;
	skills?: string[];
	fileIds?: string[];
	filesMap?: Record<string, { id: string; filename: string; sizeBytes: number }>;
}

export function ThinkingBox({
	thinking,
	isStreamingThinking = false,
	skills = [],
	fileIds = [],
	filesMap = {},
}: ThinkingBoxProps) {
	const [isOpen, setIsOpen] = useState(isStreamingThinking);

	const hasThinking = Boolean(thinking || isStreamingThinking);
	const hasSkills = skills && skills.length > 0;
	const hasFiles = fileIds && fileIds.length > 0;

	if (!hasThinking && !hasSkills && !hasFiles) return null;

	const activeSkillObjects = HARNESS_SKILLS.filter((s) => skills.includes(s.id));

	return (
		<div className="space-y-2 pb-2">
			{/* Execution / Skill & File Activity Chips */}
			{(hasSkills || hasFiles) && (
				<div className="flex flex-wrap items-center gap-1.5 font-mono text-[10.5px]">
					{hasFiles &&
						fileIds.map((fid) => {
							const f = filesMap[fid];
							return (
								<div key={fid} className="inline-flex items-center gap-1 rounded bg-[#f4faf5] border border-[#bcd9c0] px-2 py-0.5 text-[#1d7a33] shadow-2xs">
									<FileText className="size-3" />
									<span>Đã đọc: {f?.filename || "Attachment"}</span>
								</div>
							);
						})}

					{activeSkillObjects.map((s) => (
						<div key={s.id} className="inline-flex items-center gap-1 rounded bg-[#f6f8ff] border border-[#d5daff] px-2 py-0.5 text-[#2323e6] shadow-2xs">
							<Zap className="size-3" />
							<span>Skill: {s.shortName}</span>
						</div>
					))}
				</div>
			)}

			{/* Collapsible Thinking / Reasoning Box */}
			{hasThinking && (
				<div className="overflow-hidden rounded-md border border-line bg-paper-2 text-xs transition">
					<button
						type="button"
						onClick={() => setIsOpen(!isOpen)}
						className="flex w-full items-center justify-between px-3 py-2 text-left font-mono text-[11px] text-ink-2 hover:bg-paper hover:text-ink cursor-pointer transition"
					>
						<div className="flex items-center gap-1.5">
							<Brain className={`size-3.5 ${isStreamingThinking ? "text-accent animate-pulse" : "text-accent"}`} />
							<span className="font-semibold text-ink">
								{isStreamingThinking ? "Đang suy luận (Thinking)..." : "Quá trình suy luận (Reasoning)"}
							</span>
						</div>
						<div className="flex items-center gap-1 text-ink-2">
							<span className="text-[10px]">{isOpen ? "Thu gọn" : "Chi tiết"}</span>
							<ChevronDown className={`size-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
						</div>
					</button>

					{isOpen && (
						<div className="border-t border-line/60 bg-white p-3 font-mono text-[11px] leading-relaxed text-ink-2 whitespace-pre-wrap max-h-56 overflow-y-auto">
							{thinking || "..."}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
