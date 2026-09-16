import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Brain, Sparkles, AlertTriangle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { fmtCompact, fmtNum } from "@web/lib/utils";
import type { ThreadTokensInfo } from "@web/lib/chat-tokens";

export interface ContextCompactDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	threadId: string | null;
	tokensInfo: ThreadTokensInfo;
	modelName: string;
	onCompactSuccess: () => void;
	targetSwitchModel?: { id: string; displayName: string; contextWindow: number } | null;
	onConfirmSwitch?: (modelId: string) => void;
}

export function ContextCompactDialog({
	open,
	onOpenChange,
	threadId,
	tokensInfo,
	modelName,
	onCompactSuccess,
	targetSwitchModel,
	onConfirmSwitch,
}: ContextCompactDialogProps) {
	const { i18n } = useTranslation();
	const isVi = i18n.language?.startsWith("vi");
	const [compacting, setCompacting] = useState(false);

	const isOverloadMode =
		targetSwitchModel && tokensInfo.usedTokens > (targetSwitchModel.contextWindow || 200_000);

	const handleCompact = async (andSwitch = false) => {
		if (!threadId || compacting) return;
		setCompacting(true);
		try {
			const res = await fetch(`/api/chat/threads/${threadId}/compact`, {
				method: "POST",
				credentials: "include",
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "compaction_failed");

			onCompactSuccess();
			if (andSwitch && targetSwitchModel && onConfirmSwitch) {
				onConfirmSwitch(targetSwitchModel.id);
			}
			onOpenChange(false);
		} catch (err) {
			console.error("Compact error:", err);
		} finally {
			setCompacting(false);
		}
	};

	const pct = tokensInfo.percent;
	const barColor = pct >= 80 ? "bg-[#c6293b]" : pct >= 50 ? "bg-[#e8b548]" : "bg-accent";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<div className="flex items-center gap-2 text-ink">
						<div className="flex size-8 items-center justify-center rounded-lg border border-line bg-paper-2">
							{isOverloadMode ? (
								<AlertTriangle className="size-4 text-[#c6293b]" />
							) : (
								<Brain className="size-4 text-accent" />
							)}
						</div>
						<DialogTitle className="text-lg font-semibold">
							{isOverloadMode
								? isVi
									? "Ngữ cảnh vượt quá giới hạn Model"
									: "Context Window Exceeded"
								: isVi
								? "Quản lý Ngữ cảnh & Thu gọn (Claude)"
								: "Context Window & Compactor (Claude)"}
						</DialogTitle>
					</div>
					<DialogDescription className="text-xs text-ink-2 font-mono">
						{isOverloadMode
							? isVi
								? `Cần thu gọn ngữ cảnh trước khi chuyển sang model ${targetSwitchModel?.displayName}`
								: `Compaction required before switching to ${targetSwitchModel?.displayName}`
							: isVi
							? `Theo dõi dung lượng ngữ cảnh của ${modelName} và tối ưu hóa bộ nhớ`
							: `Monitor ${modelName} context window and optimize conversation memory`}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2 text-xs">
					{/* Caution Alert if switching to smaller model */}
					{isOverloadMode && targetSwitchModel && (
						<div className="rounded-lg border border-[#c6293b]/30 bg-[#c6293b]/5 p-3 text-xs text-[#c6293b]">
							<div className="font-semibold flex items-center gap-1.5 mb-1">
								<AlertTriangle className="size-3.5 shrink-0" />
								<span>
									{isVi
										? "Không thể chuyển trực tiếp do đầy context"
										: "Cannot switch directly: Context overflow"}
								</span>
							</div>
							<p className="leading-relaxed opacity-90 text-[11.5px]">
								{isVi
									? `Model ${targetSwitchModel.displayName} chỉ hỗ trợ tối đa ${fmtCompact(targetSwitchModel.contextWindow)} tokens, trong khi ngữ cảnh hiện tại của bạn đang là ${fmtCompact(tokensInfo.usedTokens)} tokens. Hãy bấm "Thu gọn & Chuyển" bên dưới.`
									: `Model ${targetSwitchModel.displayName} supports up to ${fmtCompact(targetSwitchModel.contextWindow)} tokens, but current conversation context is ${fmtCompact(tokensInfo.usedTokens)} tokens. Please compact first.`}
							</p>
						</div>
					)}

					{/* Context Usage Meter */}
					<div className="rounded-lg border border-line bg-paper/50 p-3.5 space-y-2.5">
						<div className="flex items-center justify-between text-[11px] font-mono">
							<span className="text-ink-2 uppercase tracking-wider">
								{isVi ? "Dung lượng đã dùng" : "Used Context"}:
							</span>
							<span className="font-semibold text-ink">
								{fmtNum(tokensInfo.usedTokens)} / {fmtNum(tokensInfo.contextWindow)} tokens ({pct}%)
							</span>
						</div>

						{/* Progress Track */}
						<div className="h-2 w-full overflow-hidden rounded-full bg-paper-2 border border-line/50">
							<div
								className={`h-full transition-all duration-300 ${barColor}`}
								style={{ width: `${Math.min(100, Math.max(1, pct))}%` }}
							/>
						</div>

						<div className="flex items-center justify-between text-[10.5px] font-mono text-ink-2/70 pt-0.5">
							<span>
								{isVi ? "Còn lại" : "Remaining"}:{" "}
								<b className="text-ink font-semibold">
									{fmtCompact(Math.max(0, tokensInfo.contextWindow - tokensInfo.usedTokens))} tokens
								</b>
							</span>
							<span>
								{isVi ? "Model hiện tại" : "Active Model"}:{" "}
								<span className="text-ink font-mono">{modelName}</span>
							</span>
						</div>
					</div>

					{/* How Claude Compaction works */}
					<div className="rounded-lg border border-line/60 bg-white p-3 space-y-1.5">
						<div className="flex items-center gap-1.5 font-semibold text-ink text-xs">
							<Sparkles className="size-3.5 text-accent" />
							<span>
								{isVi
									? "Lối thu gọn ngữ cảnh của Claude (Working Memory)"
									: "Claude-Style Working Memory Compactor"}
							</span>
						</div>
						<p className="text-[11px] leading-relaxed text-ink-2">
							{isVi
								? "Tự động phân tích và cô đọng lịch sử hội thoại thành 5 phần cốt lõi (Mục tiêu, Quyết định kiến trúc, Trạng thái code/file, Việc cần làm tiếp theo, Chi tiết quan trọng), loại bỏ rác đàm thoại và giải phóng tới 85–95% dung lượng context mà không mất thông tin then chốt."
								: "Distills conversation turns into 5 structured engineering sections (Primary Goals, Architectural Decisions, Implementation State, Pending Tasks, Critical Details), freeing 85–95% of the context window with zero loss of key project state."}
						</p>
					</div>
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="ghost" onClick={() => onOpenChange(false)} disabled={compacting}>
						{isVi ? "Đóng" : "Close"}
					</Button>
					<Button
						variant="default"
						onClick={() => handleCompact(Boolean(isOverloadMode))}
						disabled={compacting || !tokensInfo.canCompact}
						className={`gap-1.5 ${isOverloadMode ? "bg-[#c6293b] hover:bg-[#b02232] text-white" : ""}`}
					>
						{compacting ? (
							<>
								<Loader2 className="size-3.5 animate-spin" />
								<span>{isOverloadMode ? (isVi ? "Đang thu gọn & chuyển..." : "Compacting & switching...") : (isVi ? "Đang thu gọn..." : "Compacting context...")}</span>
							</>
						) : (
							<>
								{isOverloadMode ? <ArrowRight className="size-3.5" /> : <Sparkles className="size-3.5" />}
								<span>{isOverloadMode ? (isVi ? "Thu gọn & Chuyển model" : "Compact & Switch Model") : (isVi ? "Thu gọn ngữ cảnh ngay" : "Compact Context Now")}</span>
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
