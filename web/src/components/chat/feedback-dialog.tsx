import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquareWarning, Send, ThumbsDown } from "lucide-react";
import { apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Textarea } from "@web/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";

const FEEDBACK_REASONS = [
	{ id: "incorrect", labelEn: "Incorrect or inaccurate", labelVi: "Câu trả lời sai hoặc không chính xác" },
	{ id: "format", labelEn: "Wrong format or styling", labelVi: "Không đúng định dạng mong muốn" },
	{ id: "incomplete", labelEn: "Too brief or missing details", labelVi: "Quá ngắn hoặc thiếu chi tiết" },
	{ id: "hallucination", labelEn: "Hallucination / Made up facts", labelVi: "Thông tin bịa đặt / Ảo giác" },
	{ id: "other", labelEn: "Other issue", labelVi: "Ý kiến khác" },
];

interface FeedbackDialogProps {
	messageId: string | null;
	threadId: string | null;
	messagePreview?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

export function FeedbackDialog({
	messageId,
	threadId,
	messagePreview,
	open,
	onOpenChange,
	onSuccess,
}: FeedbackDialogProps) {
	const { i18n } = useTranslation();
	const isVi = i18n.language?.startsWith("vi");

	const [reason, setReason] = useState<string>("incorrect");
	const [comment, setComment] = useState("");

	const submit = useMutation({
		mutationFn: () =>
			apiJson(`/api/chat/messages/${messageId}/feedback`, "POST", {
				threadId: threadId || "",
				reason,
				comment: comment.trim() || undefined,
				messagePreview: messagePreview?.slice(0, 300),
			}),
		onSuccess: () => {
			toast.success(isVi ? "Đã ghi nhận ý kiến đóng góp của bạn!" : "Thank you for your feedback!");
			onSuccess?.();
			onOpenChange(false);
			setComment("");
		},
		onError: (err) => toast.error((err as Error).message),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<div className="flex size-7 items-center justify-center rounded-full bg-[#fdf2f2] text-[#c6293b]">
							<ThumbsDown className="size-3.5" />
						</div>
						<DialogTitle>{isVi ? "Góp ý câu trả lời" : "Message Feedback"}</DialogTitle>
					</div>
					<DialogDescription>
						{isVi
							? "Cho chúng tôi biết vấn đề bạn gặp phải để cải thiện chất lượng phản hồi."
							: "Help us understand what went wrong with this response to improve future outputs."}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3 py-2 text-xs font-mono">
					{/* Reasons selector */}
					<div className="space-y-1.5">
						<span className="text-[10.5px] uppercase tracking-wider text-ink-2 font-semibold">
							{isVi ? "Lý do không hài lòng:" : "Select primary issue:"}
						</span>
						<div className="grid gap-1.5 sm:grid-cols-2">
							{FEEDBACK_REASONS.map((r) => {
								const active = reason === r.id;
								return (
									<button
										key={r.id}
										type="button"
										onClick={() => setReason(r.id)}
										className={`rounded border p-2 text-left transition cursor-pointer ${
											active
												? "border-accent bg-accent text-white font-medium shadow-xs"
												: "border-line bg-white text-ink hover:bg-paper-2"
										}`}
									>
										{isVi ? r.labelVi : r.labelEn}
									</button>
								);
							})}
						</div>
					</div>

					{/* Detailed comment */}
					<div className="space-y-1.5">
						<span className="text-[10.5px] uppercase tracking-wider text-ink-2 font-semibold">
							{isVi ? "Ghi chú thêm (tùy chọn):" : "Additional details (optional):"}
						</span>
						<Textarea
							value={comment}
							onChange={(e) => setComment(e.target.value)}
							placeholder={isVi ? "Mô tả cụ thể câu trả lời bị lỗi hoặc thiếu gì..." : "Describe what was missing or incorrect..."}
							className="h-20 text-xs font-mono"
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{isVi ? "Hủy" : "Cancel"}
					</Button>
					<Button onClick={() => submit.mutate()} disabled={submit.isPending}>
						<Send className="size-3" />
						<span>{isVi ? "Gửi phản hồi" : "Submit"}</span>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
