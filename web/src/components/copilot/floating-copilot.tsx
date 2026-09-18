import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
	X, 
	Terminal, 
	Copy, 
	Check, 
	ArrowRight,
	RotateCcw,
	Send
} from "lucide-react";
import { toast } from "sonner";
import { apiJson } from "@web/lib/api";
import { useTour, type TourStep } from "@web/lib/tour-context";

interface CopilotMessage {
	id: string;
	role: "assistant" | "user";
	content: string;
	tour?: {
		title: string;
		steps: TourStep[];
	};
	tourId?: string;
	tourLabel?: string;
	externalSnippet?: {
		title: string;
		code: string;
		hint?: string;
	};
}

const INITIAL_MESSAGES: CopilotMessage[] = [
	{
		id: "welcome",
		role: "assistant",
		content: "Xin chào ní! Tui là mnRouter Copilot. Ní có thể đặt câu hỏi về hệ thống hoặc bấm vào các chủ đề bên dưới để tui khoanh vùng chỉ từng bước trực tiếp trên màn hình nha.",
	},
];

const SUGGESTIONS = [
	{ label: "Tạo API Key", query: "Làm sao để tạo API Key?" },
	{ label: "Cấu hình Tools CLI", query: "Làm sao cấu hình Codex hoặc Claude Code?" },
	{ label: "Chat & Đổi Model", query: "Cách sử dụng Chat và đổi Model AI?" },
	{ label: "Trạng thái Server", query: "Xem tình trạng server và uptime ở đâu?" },
	{ label: "Mời thành viên", query: "Làm sao để mời nhiều người cùng lúc?" },
	{ label: "Lệnh Bot Telegram", query: "Các lệnh bot Telegram dùng thế nào?" },
];

export function FloatingCopilot() {
	const [isOpen, setIsOpen] = useState(false);
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<CopilotMessage[]>(INITIAL_MESSAGES);
	const [copiedCode, setCopiedCode] = useState<string | null>(null);
	const [isThinking, setIsThinking] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const { startTour, startCustomTour, isTourActive } = useTour();
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setIsOpen((prev) => {
					const next = !prev;
					if (next) {
						setTimeout(() => inputRef.current?.focus(), 40);
						setTimeout(() => inputRef.current?.focus(), 120);
					}
					return next;
				});
			} else if (e.key === "Escape" && isOpen) {
				setIsOpen(false);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen]);

	// Auto-scroll and ensure robust focus when expanded
	useEffect(() => {
		if (isOpen) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

	const handleSend = async (textToSend?: string) => {
		const query = (textToSend || input).trim();
		if (!query || isThinking) return;

		const userMsg: CopilotMessage = {
			id: String(Date.now()),
			role: "user",
			content: query,
		};

		setMessages((prev) => [...prev, userMsg]);
		if (!textToSend) setInput("");
		setIsThinking(true);

		try {
			const res = await apiJson<{
				content: string;
				tour?: { title: string; steps: TourStep[] };
				externalSnippet?: { title: string; code: string; hint?: string };
			}>("/api/copilot/ask", "POST", { query });

			const replyMsg: CopilotMessage = {
				id: String(Date.now() + 1),
				role: "assistant",
				content: res.content,
				tour: res.tour,
				tourLabel: res.tour?.title ? `Chỉ từng bước: ${res.tour.title}` : undefined,
				externalSnippet: res.externalSnippet,
			};
			setMessages((prev) => [...prev, replyMsg]);
		} catch {
			// Fallback local resolver if server or network error
			const reply = resolveCopilotReply(query);
			setMessages((prev) => [...prev, reply]);
		} finally {
			setIsThinking(false);
		}
	};

	const handleStartAnyTour = (msg: CopilotMessage) => {
		setIsOpen(false);
		if (msg.tour && msg.tour.steps && msg.tour.steps.length > 0) {
			startCustomTour({
				id: "ai-tour-" + Date.now(),
				title: msg.tour.title,
				description: "",
				steps: msg.tour.steps,
			});
		} else if (msg.tourId) {
			startTour(msg.tourId);
		}
	};

	// Hide floating bar if a tour is currently running
	if (isTourActive) return null;

	return (
		<div className="fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-[9990] select-none">
			<AnimatePresence mode="wait">
				{!isOpen ? (
					/* Subtle translucent bar at bottom center */
					<motion.button
						key="collapsed-bar"
						type="button"
						initial={{ opacity: 0, y: 12, scale: 0.96 }}
						animate={{ opacity: 0.85, y: 0, scale: 1 }}
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
								Hỏi Copilot hoặc tìm kiếm...
							</span>
						</div>

						<div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] text-ink-2/80">
							<kbd className="rounded border border-line/70 bg-paper-2 px-1.5 py-0.5">
								⌘K
							</kbd>
						</div>
					</motion.button>
				) : (
					/* Refined Raycast/Linear style Command Palette Card */
					<motion.div
						key="expanded-card"
						initial={{ opacity: 0, y: 16, scale: 0.94 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 16, scale: 0.94 }}
						transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
						className="flex flex-col w-[540px] max-w-[calc(100vw-28px)] h-[470px] max-h-[calc(100dvh-64px)] rounded-xl border border-line bg-white shadow-2xl overflow-hidden font-sans"
					>
						{/* Top Input & Search Bar */}
						<form
							onSubmit={(e) => {
								e.preventDefault();
								handleSend();
							}}
							className="flex items-center gap-2.5 border-b border-line bg-white px-3.5 py-2.5 shrink-0"
						>
							<span className="font-mono text-sm font-bold text-accent select-none shrink-0">
								&gt;
							</span>

							<input
								ref={inputRef}
								autoFocus
								type="text"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder="Hỏi bất cứ điều gì (tạo key, cài codex, kiểm tra status)..."
								className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-2/50 focus:outline-none font-mono"
							/>

							<div className="flex items-center gap-1 shrink-0">
								{input.trim() && (
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
									onClick={() => setMessages(INITIAL_MESSAGES)}
									className="rounded p-1 text-ink-2 hover:bg-paper-2 hover:text-ink transition cursor-pointer"
									title="Đặt lại hội thoại"
								>
									<RotateCcw className="size-3" />
								</button>

								<button
									type="button"
									onClick={() => setIsOpen(false)}
									className="rounded p-1 text-ink-2 hover:bg-paper-2 hover:text-ink transition cursor-pointer"
									title="Đóng (Esc)"
								>
									<X className="size-3.5" />
								</button>
							</div>
						</form>

						{/* Suggestion Chips */}
						<div className="border-b border-line/60 bg-paper/30 px-3.5 py-2 shrink-0">
							<div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
								{SUGGESTIONS.map((s, idx) => (
									<button
										key={idx}
										type="button"
										onClick={() => handleSend(s.query)}
										className="shrink-0 rounded-md border border-line/80 bg-white px-2.5 py-1 font-mono text-[11px] text-ink-2 hover:border-accent hover:text-accent transition cursor-pointer shadow-2xs"
									>
										{s.label}
									</button>
								))}
							</div>
						</div>

						{/* Dialogue Body */}
						<div className="flex-1 overflow-y-auto p-4 space-y-3 bg-paper/10 text-xs [scrollbar-width:thin]">
							{messages.map((msg) => (
								<div
									key={msg.id}
									className={`flex flex-col gap-1 ${
										msg.role === "user" ? "items-end" : "items-start"
									}`}
								>
									<div
										className={`p-3 max-w-[94%] leading-relaxed ${
											msg.role === "user"
												? "rounded-lg bg-paper-2 border border-line text-ink font-mono text-xs"
												: "rounded-lg bg-white border border-line text-ink shadow-2xs space-y-2.5"
										}`}
									>
										<p className="whitespace-pre-wrap">{msg.content}</p>

										{/* Interactive Tour Action Button */}
										{(msg.tour || msg.tourId) && (
											<div className="pt-2 border-t border-line/60">
												<button
													type="button"
													onClick={() => handleStartAnyTour(msg)}
													className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/5 px-3 py-1.5 font-mono text-xs font-semibold text-accent hover:bg-accent hover:text-white transition cursor-pointer"
												>
													<span>{msg.tourLabel || (msg.tour?.title ? `Chỉ từng bước: ${msg.tour.title}` : "Chỉ từng bước trên màn hình")}</span>
													<ArrowRight className="size-3" />
												</button>
											</div>
										)}
										{/* External CLI / Terminal Instruction Box */}
										{msg.externalSnippet && (
											<div className="rounded border border-line bg-paper/50 p-2.5 space-y-1.5 font-mono text-[11px]">
												<div className="flex items-center justify-between text-ink-2 text-[10px]">
													<div className="flex items-center gap-1.5">
														<Terminal className="size-3 text-accent" />
														<span className="font-semibold">{msg.externalSnippet.title}</span>
													</div>
													<button
														type="button"
														onClick={() => copyToClipboard(msg.externalSnippet!.code)}
														className="inline-flex items-center gap-1 text-accent hover:underline cursor-pointer"
													>
														{copiedCode === msg.externalSnippet.code ? (
															<Check className="size-3 text-[#1d7a33]" />
														) : (
															<Copy className="size-3" />
														)}
														<span>Sao chép</span>
													</button>
												</div>
												<pre className="p-2 rounded bg-white border border-line/70 text-ink overflow-x-auto text-[10.5px]">
													<code>{msg.externalSnippet.code}</code>
												</pre>
												{msg.externalSnippet.hint && (
													<p className="text-[10.5px] text-ink-2 font-sans">
														{msg.externalSnippet.hint}
													</p>
												)}
											</div>
										)}
									</div>
								</div>
							))}

							{/* AI Thinking Indicator */}
							{isThinking && (
								<div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-2/70 p-2 bg-paper/40 rounded-lg border border-line/50">
									<span className="size-1.5 rounded-full bg-accent animate-ping" />
									<span>Copilot đang phân tích câu hỏi và sinh bước chỉ dẫn...</span>
								</div>
							)}
							<div ref={messagesEndRef} />
						</div>

						{/* Minimal Bottom Bar */}
						<div className="flex items-center justify-between border-t border-line bg-white px-3.5 py-1.5 text-[10.5px] font-mono text-ink-2/60 shrink-0">
							<span>// mnRouter Copilot</span>
							<div className="flex items-center gap-2">
								<span>Esc để đóng</span>
								<span>&middot;</span>
								<span>⌘K để mở lại</span>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

// Intelligent helper response resolver
function resolveCopilotReply(query: string): CopilotMessage {
	const q = query.toLowerCase();

	// 1. API Keys Guide
	if (q.includes("api key") || q.includes("tạo key") || q.includes("lấy key") || q.includes("key")) {
		return {
			id: String(Date.now()),
			role: "assistant",
			content: "Để tạo API Key kết nối các công cụ AI bên ngoài, bạn vào trang API Keys, bấm '+ Create API key', đặt tên mô tả rồi lưu mã key 'mr_...' lại. Bấm nút bên dưới để bật chế độ làm mờ màn hình và khoanh vùng chỉ dẫn từng bước:",
			tourId: "create-api-key",
			tourLabel: "Bắt đầu chỉ từng bước tạo API Key",
		};
	}

	// 2. Tools Config (Codex, Claude, OMP)
	if (q.includes("codex") || q.includes("claude") || q.includes("omp") || q.includes("cấu hình") || q.includes("config") || q.includes("cli")) {
		return {
			id: String(Date.now()),
			role: "assistant",
			content: "Trang Tools Config cung cấp script tự động cài đặt models, token và router URL cho máy tính của bạn (hỗ trợ cả macOS/Linux và Windows PowerShell). Bạn có thể bấm nút bên dưới để xem hướng dẫn trực tiếp, hoặc chạy lệnh Terminal này:",
			tourId: "tools-config",
			tourLabel: "Bắt đầu chỉ từng bước cài Tools",
			externalSnippet: {
				title: "Terminal Command (Cài Codex 1-Click)",
				code: "curl -s https://mnrouter.mncuchiinhuttt.dev/api/setup/codex | bash",
				hint: "Mở Terminal trên máy tính, dán dòng lệnh trên vào và nhấn Enter.",
			},
		};
	}

	// 3. Chat & Models
	if (q.includes("chat") || q.includes("model") || q.includes("context") || q.includes("thu gọn") || q.includes("hỏi")) {
		return {
			id: String(Date.now()),
			role: "assistant",
			content: "Khu vực Chat & Agent hỗ trợ hơn 40 models hàng đầu (Claude, Gemini, Codex, Grok, Muse Spark...) cùng tính năng phân tích tài liệu và nén ngữ cảnh working memory. Bấm nút dưới để xem các vị trí điều khiển:",
			tourId: "chat-workspace",
			tourLabel: "Xem hướng dẫn Chat & Model",
		};
	}

	// 4. Server Status
	if (q.includes("status") || q.includes("trạng thái") || q.includes("uptime") || q.includes("hoạt động") || q.includes("server")) {
		return {
			id: String(Date.now()),
			role: "assistant",
			content: "Trang Server Status cho phép bạn theo dõi tình trạng hoạt động thời gian thực của các nhà cung cấp, kiểm tra uptime 30 ngày và nhật ký bảo trì.",
			tourId: "server-status",
			tourLabel: "Mở Server Status",
		};
	}

	// 5. Invitations (Admin)
	if (q.includes("mời") || q.includes("invite") || q.includes("thành viên") || q.includes("user") || q.includes("người dùng")) {
		return {
			id: String(Date.now()),
			role: "assistant",
			content: "Tính năng Mời thành viên cho phép quản trị viên nhập nhiều email cùng lúc (gõ email nhấn Enter hoặc dán danh sách từ bảng tính) để cấp chung gói tài nguyên và danh sách model được phép sử dụng.",
			tourId: "invite-members",
			tourLabel: "Xem cách mời nhiều người",
		};
	}

	// 6. Telegram Bot
	if (q.includes("telegram") || q.includes("bot") || q.includes("lệnh") || q.includes("slash")) {
		return {
			id: String(Date.now()),
			role: "assistant",
			content: "Bot Telegram @mnrouter_bot hỗ trợ nhận thông báo lỗi, cooldown và tra cứu thông tin máy chủ qua bộ lệnh Slash Commands. Các lệnh phổ biến gồm có:",
			externalSnippet: {
				title: "Telegram Slash Commands",
				code: "/status - Xem sức khoẻ máy chủ\n/usage - Xem lưu lượng tokens trong ngày\n/quotas - Kiểm tra hạn mức các hãng\n/logs - Xem 5 lượt request gần nhất\n/invite <email> [gói] - Tạo link mời trực tiếp",
				hint: "Mở ứng dụng Telegram, tìm @mnrouter_bot và gõ ký tự / để xem danh sách lệnh.",
			},
		};
	}

	// Default fallback
	return {
		id: String(Date.now()),
		role: "assistant",
		content: "Tui có thể hỗ trợ bạn về: Tạo API Key, Cấu hình Tools (Codex/Claude), Sử dụng Chat, Xem trạng thái Server hoặc Mời thành viên mới. Bạn hãy bấm vào các gợi ý bên trên hoặc gõ câu hỏi nha.",
	};
}
