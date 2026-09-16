import { useMemo, useState } from "react";
import { ArrowRight, Check, MessageSquare, PenLine, Send, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type ClarifyOption, type ClarificationData, extractClarification } from "./clarification-parser";

export { extractClarification, type ClarifyOption, type ClarificationData };

export interface ClarificationBoxProps {
	data: ClarificationData;
	onSelect: (answer: string) => void;
	disabled?: boolean;
	docked?: boolean;
	onDismiss?: () => void;
}

export function ClarificationBox({
	data,
	onSelect,
	disabled = false,
	docked = false,
	onDismiss,
}: ClarificationBoxProps) {
	const { i18n } = useTranslation();
	const isVi = i18n.language?.startsWith("vi");

	const [selectedSingle, setSelectedSingle] = useState<string | null>(null);
	const [selectedMulti, setSelectedMulti] = useState<string[]>([]);
	const [otherOpen, setOtherOpen] = useState(false);
	const [otherText, setOtherText] = useState("");
	const [freeText, setFreeText] = useState("");

	const isMulti = data.type === "multi";
	const isFreeText = data.type === "text";

	const optionsList = useMemo(() => {
		if (isFreeText) return [];
		const opts = [...data.options];

		const hasChatMore = opts.some(
			(o) => o.id === "chat-more" || o.label.toLowerCase().includes("chat more") || o.label.toLowerCase().includes("thảo luận thêm")
		);
		if (!hasChatMore && data.allowChatMore !== false) {
			opts.push({
				id: "chat-more",
				label: isVi ? "Thảo luận thêm về điều này" : "Chat more about this",
				description: isVi
					? "Giải thích chi tiết ưu/nhược điểm từng phương án trước khi quyết định"
					: "Explore pros & cons or discuss details before deciding",
			});
		}

		const hasOther = opts.some(
			(o) => o.id === "other" || o.label.toLowerCase().includes("other") || o.label.toLowerCase().includes("khác")
		);
		if (!hasOther && !isMulti) {
			opts.push({
				id: "other",
				label: isVi ? "Ý kiến khác" : "Other (Custom)",
				description: isVi ? "Tự nhập yêu cầu hoặc định dạng tùy chỉnh" : "Type your specific preference or custom requirement",
			});
		}

		return opts;
	}, [data.options, isMulti, isFreeText, isVi, data.allowChatMore]);

	const handleOptionClick = (opt: ClarifyOption) => {
		if (disabled) return;
		if (opt.id === "chat-more") {
			const prompt = isVi
				? "Tôi muốn thảo luận thêm về các lựa chọn này. Hãy giải thích chi tiết ưu và nhược điểm của từng phương án trước khi tôi đưa ra quyết định."
				: "I want to discuss more about these options. Please explain the pros and cons of each choice in detail before I make a decision.";
			setSelectedSingle(opt.label);
			onSelect(prompt);
			return;
		}
		if (opt.id === "other") {
			setOtherOpen(true);
			return;
		}
		if (isMulti) {
			setSelectedMulti((prev) => (prev.includes(opt.label) ? prev.filter((x) => x !== opt.label) : [...prev, opt.label]));
			return;
		}
		setSelectedSingle(opt.label);
		onSelect(opt.label);
	};

	const handleConfirmMulti = () => {
		if (disabled || selectedMulti.length === 0) return;
		onSelect(isVi ? `Tôi chọn các phương án: ${selectedMulti.join(", ")}` : `I choose the following options: ${selectedMulti.join(", ")}`);
	};

	const handleSendOther = () => {
		const val = otherText.trim();
		if (!val || disabled) return;
		setSelectedSingle(val);
		onSelect(val);
	};

	const handleSendFreeText = () => {
		const val = freeText.trim();
		if (!val || disabled) return;
		onSelect(val);
	};

	return (
		<div className={`rounded-xl border border-accent/30 bg-white/95 p-3.5 shadow-md backdrop-blur-xs transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${docked ? "ring-1 ring-accent/20" : "mt-2.5"}`}>
			<div className="flex items-center justify-between gap-2 pb-2.5 border-b border-line/60">
				<div className="flex items-center gap-2 font-medium text-ink text-xs">
					<div className="flex size-5 items-center justify-center rounded-md bg-accent/10 text-accent"><Sparkles className="size-3" /></div>
					<span className="font-semibold">{data.question || (isVi ? "Vui lòng chọn hướng xử lý:" : "Please choose an approach:")}</span>
				</div>
				<div className="flex items-center gap-1.5 shrink-0">
					{isMulti && <span className="rounded bg-paper-2 px-1.5 py-0.5 text-[10px] font-mono text-ink-2 border border-line">{isVi ? "Chọn nhiều" : "Multi-select"}</span>}
					{onDismiss && <button type="button" onClick={onDismiss} className="text-ink-2/60 hover:text-ink text-[11px] font-mono cursor-pointer px-1">✕</button>}
				</div>
			</div>

			{isFreeText ? (
				<div className="pt-2.5 space-y-2">
					<textarea value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder={isVi ? "Nhập câu trả lời hoặc yêu cầu của bạn..." : "Type your answer or requirement..."} rows={2} className="w-full rounded-md border border-line bg-paper p-2 font-mono text-xs text-ink outline-none focus:border-accent" autoFocus />
					<div className="flex justify-end">
						<button type="button" onClick={handleSendFreeText} disabled={!freeText.trim() || disabled} className="flex h-7 items-center gap-1.5 rounded-md bg-accent px-3 font-mono text-xs font-semibold text-white disabled:opacity-40 cursor-pointer shadow-xs transition active:scale-[0.98]">
							<span>{isVi ? "Gửi câu trả lời" : "Submit Answer"}</span>
							<Send className="size-3" />
						</button>
					</div>
				</div>
			) : (
				<div className="pt-2.5 space-y-2.5">
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{optionsList.map((opt, i) => {
							const isChosen = isMulti ? selectedMulti.includes(opt.label) : selectedSingle === opt.label || (opt.id === "other" && otherOpen);
							const isSpecialChatMore = opt.id === "chat-more";
							return (
								<button key={opt.id || i} type="button" onClick={() => handleOptionClick(opt)} disabled={disabled || (selectedSingle !== null && !isChosen && !isMulti)} className={`group flex flex-col justify-between rounded-lg border p-2.5 text-left transition cursor-pointer select-none active:scale-[0.98] ${isChosen ? "border-accent bg-accent text-white font-medium shadow-xs" : isSpecialChatMore ? "border-accent/40 bg-accent/5 text-ink hover:border-accent hover:bg-accent/10" : selectedSingle !== null && !isMulti ? "border-line bg-white/40 opacity-40 cursor-not-allowed" : "border-line bg-paper/60 text-ink hover:border-accent hover:bg-white hover:shadow-xs"}`}>
									<div className="flex items-start justify-between gap-1.5">
										<div className="flex items-center gap-1.5">
											{isMulti && <div className={`flex size-3.5 items-center justify-center rounded border transition ${isChosen ? "border-white bg-white text-accent" : "border-line bg-white"}`}>{isChosen && <Check className="size-2.5 stroke-[3]" />}</div>}
											<span className="font-semibold text-[11.5px] leading-snug">{opt.label}</span>
										</div>
										{opt.id === "other" ? <PenLine className={`size-3 shrink-0 ${isChosen ? "text-white" : "text-ink-2 group-hover:text-accent"}`} /> : isSpecialChatMore ? <MessageSquare className={`size-3 shrink-0 ${isChosen ? "text-white" : "text-accent"}`} /> : <ArrowRight className={`size-3 shrink-0 transition-transform group-hover:translate-x-0.5 ${isChosen ? "text-white" : "text-ink-2 group-hover:text-accent"}`} />}
									</div>
									{opt.description && <p className={`mt-1 text-[10.5px] leading-relaxed line-clamp-2 ${isChosen ? "text-white/80" : "text-ink-2"}`}>{opt.description}</p>}
								</button>
							);
						})}
					</div>

					{isMulti && (
						<div className="flex items-center justify-between pt-1 border-t border-line/60">
							<span className="text-[11px] font-mono text-ink-2">{isVi ? `Đã chọn ${selectedMulti.length} mục` : `${selectedMulti.length} item(s) selected`}</span>
							<button type="button" onClick={handleConfirmMulti} disabled={selectedMulti.length === 0 || disabled} className="flex h-7 items-center gap-1.5 rounded-md bg-accent px-3.5 font-mono text-xs font-semibold text-white disabled:opacity-40 cursor-pointer shadow-xs transition active:scale-[0.98]">
								<span>{isVi ? `Xác nhận lựa chọn (${selectedMulti.length})` : `Confirm Selection (${selectedMulti.length})`}</span>
								<ArrowRight className="size-3" />
							</button>
						</div>
					)}

					{otherOpen && selectedSingle === null && (
						<div className="flex items-center gap-2 pt-1 border-t border-line/60">
							<input type="text" value={otherText} onChange={(e) => setOtherText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSendOther(); }} placeholder={isVi ? "Nhập yêu cầu hoặc định dạng bạn muốn..." : "Type your custom requirement..."} className="h-8 flex-1 rounded border border-line bg-white px-3 font-mono text-xs text-ink outline-none focus:border-accent" autoFocus />
							<button type="button" onClick={handleSendOther} disabled={!otherText.trim() || disabled} className="flex h-8 items-center gap-1 rounded bg-accent px-3 font-mono text-xs font-semibold text-white disabled:opacity-40 cursor-pointer shadow-xs">
								<span>{isVi ? "Gửi" : "Send"}</span>
								<Send className="size-3" />
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
