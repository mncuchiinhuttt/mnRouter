import { useState, useRef } from "react";
import { Brain, Sparkles, AlertTriangle, CheckCircle2, ChevronRight, Layers, Minimize2 } from "lucide-react";
import { fmtCompact, fmtNum } from "@web/lib/utils";
import type { ThreadTokensInfo } from "@web/lib/chat-tokens";

interface ContextPillPopoverProps {
	tokensInfo: ThreadTokensInfo;
	onOpenCompact?: () => void;
	threadId?: string | null;
	isVi?: boolean;
}

export function ContextPillPopover({
	tokensInfo,
	onOpenCompact,
	threadId,
	isVi = false,
}: ContextPillPopoverProps) {
	const [isOpen, setIsOpen] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleMouseEnter = () => {
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		setIsOpen(true);
	};

	const handleMouseLeave = () => {
		timeoutRef.current = setTimeout(() => {
			setIsOpen(false);
		}, 200);
	};

	const remainingTokens = Math.max(0, tokensInfo.contextWindow - tokensInfo.usedTokens);
	const remainingPercent = Math.max(0, 100 - tokensInfo.percent);

	const statusColor =
		tokensInfo.percent >= 80
			? "text-[#c6293b]"
			: tokensInfo.percent >= 50
			? "text-[#d97706]"
			: "text-[#1d7a33]";

	const progressBg =
		tokensInfo.percent >= 80
			? "bg-[#c6293b]"
			: tokensInfo.percent >= 50
			? "bg-[#d97706]"
			: "bg-[#1d7a33]";

	const statusText =
		tokensInfo.percent >= 80
			? (isVi ? "Sắp đầy" : "High load")
			: tokensInfo.percent >= 50
			? (isVi ? "Trung bình" : "Moderate")
			: (isVi ? "Tối ưu" : "Optimal");

	return (
		<div
			className="relative inline-block"
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			{/* Context Pill (Clickable) */}
			<button
				type="button"
				onClick={onOpenCompact}
				className={`flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10.5px] transition cursor-pointer shadow-2xs select-none ${
					tokensInfo.percent >= 80
						? "border-[#c6293b] bg-[#c6293b]/10 text-[#c6293b] font-bold animate-pulse"
						: tokensInfo.percent >= 50
						? "border-[#d97706] bg-[#d97706]/10 text-[#d97706] font-medium"
						: "border-line bg-paper-2 text-ink-2 hover:border-accent hover:text-ink"
				}`}
			>
				<Brain className="size-3 text-accent shrink-0" />
				<span className="text-[9.5px] uppercase tracking-wider text-ink-2/70 font-semibold">
					Context:
				</span>
				<span className="font-semibold text-ink">
					{fmtCompact(tokensInfo.usedTokens)} / {fmtCompact(tokensInfo.contextWindow)}
				</span>
				<span className="opacity-70">({tokensInfo.percent}%)</span>
				{tokensInfo.canCompact && tokensInfo.percent >= 50 && (
					<span className="rounded bg-accent/15 border border-accent/30 text-accent px-1 py-0.2 text-[8.5px] font-bold uppercase">
						{isVi ? "Thu gọn" : "Compact"}
					</span>
				)}
			</button>

			{/* Hover Popover Card */}
			{isOpen && (
				<div
					className="absolute bottom-full right-0 mb-2 w-80 rounded-xl border border-line bg-white p-4 shadow-xl z-50 text-xs space-y-3.5 animate-in fade-in zoom-in-95 duration-150"
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
				>
					{/* Popover Header */}
					<div className="flex items-center justify-between border-b border-line/60 pb-2.5">
						<div className="flex items-center gap-2">
							<div className="flex size-7 items-center justify-center rounded-lg border border-line bg-paper-2 text-accent">
								<Brain className="size-4" />
							</div>
							<div>
								<h4 className="font-mono text-xs font-bold text-ink">
									{isVi ? "Bộ nhớ Ngữ cảnh" : "Context Window"}
								</h4>
								<span className="text-[10.5px] text-ink-2/70 font-mono">
									Claude Working Memory
								</span>
							</div>
						</div>

						{/* Status badge */}
						<div className="inline-flex items-center gap-1.5 rounded-full border border-line/70 bg-paper-2 px-2 py-0.5 font-mono text-[10px] font-medium text-ink">
							<span className={`size-1.5 rounded-full ${progressBg}`} />
							<span className={statusColor}>{statusText}</span>
						</div>
					</div>

					{/* Visual Progress Bar */}
					<div className="space-y-1.5">
						<div className="flex items-center justify-between font-mono text-[11px]">
							<span className="text-ink-2">
								{isVi ? "Dung lượng sử dụng" : "Capacity utilized"}
							</span>
							<span className={`font-semibold ${statusColor}`}>
								{tokensInfo.percent}%
							</span>
						</div>
						<div className="h-2 w-full overflow-hidden rounded-full bg-paper-2 border border-line/60">
							<div
								className={`h-full transition-all duration-300 ${progressBg}`}
								style={{ width: `${Math.min(100, tokensInfo.percent)}%` }}
							/>
						</div>
					</div>

					{/* 2x2 Metric Grid */}
					<div className="grid grid-cols-2 gap-2 rounded-lg border border-line/60 bg-paper/40 p-2.5 font-mono text-[11px]">
						<div>
							<span className="text-ink-2/70 block text-[10px] uppercase tracking-wider">
								{isVi ? "Đã dùng" : "Used"}
							</span>
							<span className="font-semibold text-ink">
								{fmtNum(tokensInfo.usedTokens)}
							</span>
						</div>

						<div>
							<span className="text-ink-2/70 block text-[10px] uppercase tracking-wider">
								{isVi ? "Giới hạn Model" : "Max Window"}
							</span>
							<span className="font-semibold text-ink">
								{fmtCompact(tokensInfo.contextWindow)} tok
							</span>
						</div>

						<div>
							<span className="text-ink-2/70 block text-[10px] uppercase tracking-wider">
								{isVi ? "Còn lại" : "Headroom"}
							</span>
							<span className="font-semibold text-ink">
								{fmtCompact(remainingTokens)} tok
							</span>
						</div>

						<div>
							<span className="text-ink-2/70 block text-[10px] uppercase tracking-wider">
								{isVi ? "Tỷ lệ trống" : "Free Space"}
							</span>
							<span className="font-semibold text-ink">
								{remainingPercent}%
							</span>
						</div>
					</div>

					{/* Descriptive note */}
					<p className="text-[11px] text-ink-2 leading-relaxed">
						{tokensInfo.percent >= 80
							? isVi
								? "Ngữ cảnh gần đầy. Hãy bấm Thu gọn để nén các tin nhắn cũ thành bản ghi nhớ súc tích, giữ nguyên quyết định kỹ thuật."
								: "Context is near capacity. Compact now to compress older turns into a dense working memory snapshot."
							: isVi
							? "Bộ nhớ ngữ cảnh hoạt động tối ưu. Có thể bấm Thu gọn bất kỳ lúc nào để giải phóng token."
							: "Context headroom is healthy. You can compact at any time to summarize earlier conversation turns."}
					</p>

					{/* Compact Button Trigger */}
					<div className="pt-1 border-t border-line/60">
						<button
							type="button"
							onClick={() => {
								setIsOpen(false);
								onOpenCompact?.();
							}}
							disabled={!tokensInfo.canCompact}
							className={`w-full inline-flex items-center justify-center gap-1.5 rounded-md py-2 px-3 font-mono text-xs font-semibold transition cursor-pointer shadow-2xs ${
								tokensInfo.canCompact
									? "bg-accent text-white hover:bg-accent/90"
									: "bg-paper-2 border border-line text-ink-2/50 cursor-not-allowed"
							}`}
						>
							<Sparkles className="size-3.5 shrink-0" />
							<span>
								{tokensInfo.canCompact
									? isVi
										? "Thu gọn ngữ cảnh (Compact)"
										: "Compact Context"
									: isVi
									? "Cần tối thiểu 2 tin nhắn để thu gọn"
									: "Need at least 2 messages to compact"}
							</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
