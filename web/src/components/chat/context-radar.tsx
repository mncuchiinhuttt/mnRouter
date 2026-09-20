import { useMemo } from "react";
import { Gauge, Sparkles, HardDrive, FileText } from "lucide-react";
import { fmtCompact } from "@web/lib/utils";
import type { AttachedFile } from "./chat-input-bar";
import type { ThreadTokensInfo } from "@web/lib/chat-tokens";

interface ContextRadarProps {
	tokensInfo: ThreadTokensInfo;
	attachedFiles: AttachedFile[];
	inputPrompt: string;
	modelName: string;
}

export function ContextRadar({ tokensInfo, attachedFiles, inputPrompt, modelName }: ContextRadarProps) {
	// Estimate attachment tokens (~3.5 chars / token or 1 token per 4 bytes)
	const attachmentTokens = useMemo(() => {
		const totalBytes = attachedFiles.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);
		return Math.ceil(totalBytes / 4);
	}, [attachedFiles]);

	// Estimate current draft prompt tokens
	const promptTokens = useMemo(() => {
		return Math.ceil(inputPrompt.trim().length / 3.8);
	}, [inputPrompt]);

	const historyTokens = tokensInfo.usedTokens;
	const totalUsed = historyTokens + attachmentTokens + promptTokens;
	const cw = Math.max(1, tokensInfo.contextWindow);

	const histPct = Math.min(100, (historyTokens / cw) * 100);
	const attachPct = Math.min(100 - histPct, (attachmentTokens / cw) * 100);
	const draftPct = Math.min(100 - histPct - attachPct, (promptTokens / cw) * 100);
	const remainingPct = Math.max(0, 100 - histPct - attachPct - draftPct);

	const isApproachingLimit = (100 - remainingPct) >= 80;

	return (
		<div className="mx-auto w-full max-w-4xl px-1 font-mono text-[10.5px]">
			<div className="rounded-lg border border-line/70 bg-surface px-3 py-2 shadow-2xs space-y-1.5">
				{/* Header Info */}
				<div className="flex items-center justify-between text-ink-2">
					<div className="flex items-center gap-1.5">
						<Gauge className="size-3.5 text-accent" />
						<span className="font-semibold text-ink">Context Mini-Radar</span>
						<span className="text-[10px] text-ink-2">({modelName})</span>
					</div>

					<div className="flex items-center gap-3">
						<span>
							Headroom: <strong className={isApproachingLimit ? "text-[#c6293b]" : "text-[#1d7a33]"}>{remainingPct.toFixed(1)}%</strong>
						</span>
						<span>
							Total: <strong className="text-ink font-semibold">{fmtCompact(totalUsed)}</strong> / {fmtCompact(cw)}
						</span>
					</div>
				</div>

				{/* Multi-Segment Visual Bar */}
				<div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-2 flex border border-line/40">
					{/* History Tokens (Accent Blue) */}
					{histPct > 0 && (
						<div
							className="h-full bg-accent transition-all duration-300"
							style={{ width: `${histPct}%` }}
							title={`History: ${fmtCompact(historyTokens)} tok`}
						/>
					)}
					{/* Attached Files (Amber) */}
					{attachPct > 0 && (
						<div
							className="h-full bg-[#f59e0b] transition-all duration-300"
							style={{ width: `${attachPct}%` }}
							title={`Files: ${fmtCompact(attachmentTokens)} tok`}
						/>
					)}
					{/* Draft Input (Emerald) */}
					{draftPct > 0 && (
						<div
							className="h-full bg-[#10b981] transition-all duration-300"
							style={{ width: `${draftPct}%` }}
							title={`Draft: ${fmtCompact(promptTokens)} tok`}
						/>
					)}
				</div>

				{/* Breakdown Badges */}
				<div className="flex items-center justify-between text-[10px] text-ink-2 pt-0.5">
					<div className="flex items-center gap-2.5">
						<span className="flex items-center gap-1">
							<span className="size-1.5 rounded-full bg-accent" />
							<span>History: {fmtCompact(historyTokens)}</span>
						</span>
						{attachmentTokens > 0 && (
							<span className="flex items-center gap-1">
								<span className="size-1.5 rounded-full bg-[#f59e0b]" />
								<span>Files: {fmtCompact(attachmentTokens)}</span>
							</span>
						)}
						{promptTokens > 0 && (
							<span className="flex items-center gap-1">
								<span className="size-1.5 rounded-full bg-[#10b981]" />
								<span>Draft: {fmtCompact(promptTokens)}</span>
							</span>
						)}
					</div>

					<span>Buffer: {fmtCompact(Math.max(0, cw - totalUsed))} tokens free</span>
				</div>
			</div>
		</div>
	);
}
