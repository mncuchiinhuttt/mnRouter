import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
	X, 
	Terminal, 
	Copy, 
	Check, 
	Sparkles,
	Send,
	CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { apiJson } from "@web/lib/api";
import { useTour, type TourStep } from "@web/lib/tour-context";

/* Reading this as: Pure AI Navigator and Command Bar for web application guidance, with an Apple Intelligence / Raycast-style fluid animation and immediate hands-free spotlight execution. */

interface ExternalSnippet {
	title: string;
	code: string;
	hint?: string;
}

interface CopilotReply {
	content: string;
	tour?: {
		title: string;
		steps: TourStep[];
	};
	externalSnippet?: ExternalSnippet;
}

export function FloatingCopilot() {
	const [isOpen, setIsOpen] = useState(false);
	const [input, setInput] = useState("");
	const [isThinking, setIsThinking] = useState(false);
	const [externalResult, setExternalResult] = useState<{
		content: string;
		snippet?: ExternalSnippet;
	} | null>(null);
	const [copiedCode, setCopiedCode] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const { startCustomTour, isTourActive } = useTour();

	// Global shortcut Cmd+K or Ctrl+K to toggle, Esc to close
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setIsOpen((prev) => !prev);
			} else if (e.key === "Escape" && isOpen) {
				setIsOpen(false);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen]);

	// Auto-focus input when opened
	useEffect(() => {
		if (isOpen) {
			setExternalResult(null);
			const t1 = setTimeout(() => inputRef.current?.focus(), 40);
			const t2 = setTimeout(() => inputRef.current?.focus(), 120);
			return () => {
				clearTimeout(t1);
				clearTimeout(t2);
			};
		}
	}, [isOpen]);

	const copyToClipboard = (code: string) => {
		navigator.clipboard.writeText(code);
		setCopiedCode(code);
		toast.success("Đã sao chép lệnh");
		setTimeout(() => setCopiedCode(null), 2000);
	};

	const handleSubmit = async () => {
		const query = input.trim();
		if (!query || isThinking) return;

		setIsThinking(true);
		setExternalResult(null);

		try {
			const res = await apiJson<CopilotReply>("/api/copilot/ask", "POST", { query });

			// If the AI generated interactive web tour steps:
			// Automatically launch the spotlight tour immediately without user click!
			if (res.tour && res.tour.steps && res.tour.steps.length > 0) {
				setIsOpen(false);
				setInput("");
				startCustomTour({
					id: "ai-tour-" + Date.now(),
					title: res.tour.title,
					description: "",
					steps: res.tour.steps,
				});
				return;
			}

			// If it is an external task (terminal command or purely informative)
			if (res.externalSnippet || res.content) {
				setExternalResult({
					content: res.content,
					snippet: res.externalSnippet,
				});
			}
		} catch {
			toast.error("Không thể kết nối Copilot, vui lòng thử lại");
		} finally {
			setIsThinking(false);
		}
	};

	// Hide floating bar if a tour is currently running
	if (isTourActive) return null;

	return (
		<div className="fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-[9990] select-none">
			<AnimatePresence mode="wait">
				{!isOpen ? (
					/* Subtle translucent bar at bottom center (Thanh mờ mờ - hover vào rõ lên) */
					<motion.button
						key="collapsed-bar"
						type="button"
						initial={{ opacity: 0, y: 12, scale: 0.96 }}
						animate={{ opacity: 0.82, y: 0, scale: 1 }}
						whileHover={{ opacity: 1, scale: 1.02, y: -2 }}
						whileTap={{ scale: 0.98 }}
						exit={{ opacity: 0, y: 8, scale: 0.96 }}
						transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
						onClick={() => setIsOpen(true)}
						className="group flex h-9 w-[300px] sm:w-[380px] items-center justify-between gap-3 rounded-full border border-line/80 bg-white/75 px-3.5 py-1.5 shadow-xs backdrop-blur-md transition-all duration-200 hover:border-accent hover:bg-white hover:shadow-md cursor-pointer"
					>
						<div className="flex items-center gap-2 min-w-0 font-mono text-xs">
							<span className="text-accent font-bold">&gt;</span>
							<span className="text-ink-2 group-hover:text-ink transition truncate">
								Hỏi Copilot chỉ dẫn...
							</span>
						</div>

						<div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] text-ink-2/80">
							<kbd className="rounded border border-line/70 bg-paper-2 px-1.5 py-0.5">
								⌘K
							</kbd>
						</div>
					</motion.button>
				) : (
					/* Command Bar (Raycast / Spotlight style) */
					<motion.div
						key="expanded-bar"
						initial={{ opacity: 0, y: 16, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 16, scale: 0.95 }}
						transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
						className="flex flex-col w-[500px] max-w-[calc(100vw-28px)] rounded-xl border border-line bg-white shadow-2xl overflow-hidden font-sans"
					>
						{/* Top Input Bar */}
						<form
							onSubmit={(e) => {
								e.preventDefault();
								void handleSubmit();
							}}
							className="flex items-center gap-2.5 bg-white px-3.5 py-3 shrink-0"
						>
							<span className="font-mono text-sm font-bold text-accent select-none shrink-0">
								&gt;
							</span>

							<input
								ref={inputRef}
								autoFocus
								type="text"
								disabled={isThinking}
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder="Bạn muốn làm gì? (ví dụ: tạo api key, cài codex, status)..."
								className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-2/50 focus:outline-none font-mono"
							/>

							<div className="flex items-center gap-1 shrink-0">
								{input.trim() && !isThinking && (
									<button
										type="submit"
										className="rounded p-1 text-accent hover:bg-accent/10 transition cursor-pointer"
										title="Gửi"
									>
										<Send className="size-3.5" />
									</button>
								)}

								<button
									type="button"
									onClick={() => setIsOpen(false)}
									className="rounded p-1 text-ink-2 hover:bg-paper-2 hover:text-ink transition cursor-pointer font-mono text-[11px] px-1.5"
									title="Đóng (Esc)"
								>
									<X className="size-3.5" />
								</button>
							</div>
						</form>

						{/* Content Area: AI Thinking Animation OR External Result OR Subtle Hint */}
						<div className="border-t border-line/60 bg-paper/20">
							{/* 1. Hardware-accelerated GPU Thinking Animation */}
							{isThinking && (
								<div className="flex flex-col items-center justify-center py-7 px-4 space-y-2.5">
									<div className="relative flex size-8 items-center justify-center">
										<div className="size-7 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
										<Sparkles className="size-3.5 text-accent absolute" />
									</div>
									<div className="text-center space-y-0.5 font-mono text-xs text-ink">
										<span>Copilot đang phân tích...</span>
									</div>
								</div>
							)}

							{/* 2. External Result (if outside web action) */}
							{!isThinking && externalResult && (
								<div className="p-4 space-y-3 text-xs animate-in fade-in duration-150">
									<p className="text-ink leading-relaxed font-sans">
										{externalResult.content}
									</p>

									{externalResult.snippet && (
										<div className="rounded-lg border border-line bg-white p-3 space-y-1.5 font-mono text-[11px] shadow-2xs">
											<div className="flex items-center justify-between text-ink-2 text-[10px]">
												<div className="flex items-center gap-1.5">
													<Terminal className="size-3 text-accent" />
													<span className="font-semibold">{externalResult.snippet.title}</span>
												</div>
												<button
													type="button"
													onClick={() => copyToClipboard(externalResult.snippet!.code)}
													className="inline-flex items-center gap-1 text-accent hover:underline cursor-pointer"
												>
													{copiedCode === externalResult.snippet.code ? (
														<Check className="size-3 text-[#1d7a33]" />
													) : (
														<Copy className="size-3" />
													)}
													<span>Sao chép</span>
												</button>
											</div>
											<pre className="p-2 rounded bg-paper text-ink overflow-x-auto text-[10.5px]">
												<code>{externalResult.snippet.code}</code>
											</pre>
											{externalResult.snippet.hint && (
												<p className="text-[10.5px] text-ink-2 font-sans">
													{externalResult.snippet.hint}
												</p>
											)}
										</div>
									)}

									<div className="flex justify-end pt-1">
										<button
											type="button"
											onClick={() => setIsOpen(false)}
											className="inline-flex items-center gap-1 rounded bg-paper-2 border border-line px-3 py-1 font-mono text-xs text-ink hover:border-accent transition cursor-pointer"
										>
											<CheckCircle2 className="size-3 text-[#1d7a33]" />
											<span>Đã hiểu, đóng</span>
										</button>
									</div>
								</div>
							)}

							{/* 3. Subtle Ready State Footer */}
							{!isThinking && !externalResult && (
								<div className="flex items-center justify-between px-3.5 py-2 font-mono text-[10.5px] text-ink-2/70">
									<span>// Nhập yêu cầu và nhấn Enter</span>
									<span>Esc để đóng</span>
								</div>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
