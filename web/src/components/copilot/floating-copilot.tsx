import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
	Bot, 
	Sparkles, 
	X, 
	Minus, 
	Send, 
	Play, 
	Terminal, 
	Copy, 
	Check, 
	GripHorizontal, 
	HelpCircle,
	KeyRound,
	Wrench,
	MessageSquare,
	Activity,
	Users,
	SendHorizontal
} from "lucide-react";
import { toast } from "sonner";
import { useTour, TOURS } from "@web/lib/tour-context";

interface CopilotMessage {
	id: string;
	role: "assistant" | "user";
	content: string;
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
		content: "Xin chào ní! Tui là mnRouter Copilot. Ní cần hỗ trợ gì trên hệ thống? Tui có thể giải thích và kích hoạt chế độ chỉ dẫn từng bước trực tiếp trên màn hình cho ní luôn nhé!",
	},
];

const SUGGESTIONS = [
	{ label: "🔑 Tạo API Key", query: "Làm sao để tạo API Key?" },
	{ label: "💻 Cấu hình Tools CLI", query: "Làm sao cấu hình Codex hoặc Claude Code?" },
	{ label: "💬 Chat & Đổi Model", query: "Cách sử dụng Chat và đổi Model AI?" },
	{ label: "📊 Xem Trạng thái Server", query: "Xem tình trạng server và uptime ở đâu?" },
	{ label: "👥 Mời thành viên mới", query: "Làm sao để mời nhiều người cùng lúc?" },
	{ label: "🤖 Lệnh Bot Telegram", query: "Các lệnh bot Telegram dùng thế nào?" },
];

export function FloatingCopilot() {
	const [isOpen, setIsOpen] = useState(false);
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<CopilotMessage[]>(INITIAL_MESSAGES);
	const [copiedCode, setCopiedCode] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const { startTour, isTourActive } = useTour();

	// Auto scroll to latest message
	useEffect(() => {
		if (isOpen) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages, isOpen]);

	const copyToClipboard = (code: string) => {
		navigator.clipboard.writeText(code);
		setCopiedCode(code);
		toast.success("Đã sao chép lệnh!");
		setTimeout(() => setCopiedCode(null), 2000);
	};

	const handleSend = (textToSend?: string) => {
		const query = (textToSend || input).trim();
		if (!query) return;

		const userMsg: CopilotMessage = {
			id: String(Date.now()),
			role: "user",
			content: query,
		};

		setMessages((prev) => [...prev, userMsg]);
		if (!textToSend) setInput("");

		// Generate context-aware assistant response
		setTimeout(() => {
			const reply = resolveCopilotReply(query);
			setMessages((prev) => [...prev, reply]);
		}, 300);
	};

	const handleStartGuidedTour = (tourId: string) => {
		setIsOpen(false); // Minimize assistant so user can see full screen
		startTour(tourId);
		toast.info("Đã bật chế độ hướng dẫn trực tiếp trên màn hình!");
	};

	return (
		<>
			{/* Floating Draggable Container */}
			<motion.div
				drag
				dragMomentum={false}
				dragConstraints={{ left: -window.innerWidth + 80, right: 0, top: -window.innerHeight + 80, bottom: 0 }}
				className="fixed bottom-5 right-5 z-[9990] select-none"
			>
				{/* Minimized Bot Bubble Button */}
				{!isOpen && (
					<motion.button
						initial={{ scale: 0.8, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						whileHover={{ scale: 1.06 }}
						whileTap={{ scale: 0.95 }}
						onClick={() => setIsOpen(true)}
						className="relative flex size-13 items-center justify-center rounded-full bg-accent text-white shadow-xl hover:shadow-2xl transition cursor-pointer group"
						title="Mở mnRouter Copilot (Trợ lý hướng dẫn)"
					>
						{/* Ambient pulsing ring */}
						<span className="absolute inset-0 rounded-full bg-accent/40 animate-ping" />
						<div className="relative flex size-11 items-center justify-center rounded-full bg-accent border-2 border-white/40">
							<Bot className="size-6 text-white" />
						</div>

						{/* Small floating badge */}
						<span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[#1d7a33] text-[9px] font-bold text-white border border-white">
							<Sparkles className="size-2.5" />
						</span>
					</motion.button>
				)}

				{/* Expanded Floating Chat Assistant Card */}
				<AnimatePresence>
					{isOpen && (
						<motion.div
							initial={{ opacity: 0, scale: 0.9, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9, y: 20 }}
							transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
							className="flex flex-col w-[360px] max-w-[calc(100vw-32px)] h-[520px] max-h-[calc(100dvh-60px)] rounded-2xl border border-line bg-white shadow-2xl overflow-hidden font-sans"
						>
							{/* Header (Draggable Handle) */}
							<div className="flex items-center justify-between border-b border-line bg-navy px-3.5 py-3 text-white cursor-grab active:cursor-grabbing">
								<div className="flex items-center gap-2.5">
									<div className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-white border border-white/20">
										<Bot className="size-4.5" />
									</div>
									<div>
										<div className="flex items-center gap-1.5 font-mono text-xs font-bold leading-tight tracking-wider">
											<span>MNROUTER COPILOT</span>
											<span className="size-1.5 rounded-full bg-[#1d7a33] animate-pulse" />
										</div>
										<span className="text-[10px] text-white/70 font-mono">
											Interactive Screen Guide
										</span>
									</div>
								</div>

								{/* Control Actions */}
								<div className="flex items-center gap-1">
									<button
										onClick={() => setIsOpen(false)}
										className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white transition cursor-pointer"
										title="Thu nhỏ lại"
									>
										<Minus className="size-4" />
									</button>
									<button
										onClick={() => setIsOpen(false)}
										className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white transition cursor-pointer"
										title="Đóng"
									>
										<X className="size-4" />
									</button>
								</div>
							</div>

							{/* Messages Conversation Area */}
							<div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-paper/30 text-xs [scrollbar-width:thin]">
								{messages.map((msg) => (
									<div
										key={msg.id}
										className={`flex flex-col gap-1.5 ${
											msg.role === "user" ? "items-end" : "items-start"
										}`}
									>
										{/* Message Bubble */}
										<div
											className={`rounded-xl p-3 max-w-[92%] leading-relaxed ${
												msg.role === "user"
													? "bg-accent text-white font-medium rounded-tr-xs"
													: "bg-white border border-line text-ink rounded-tl-xs shadow-2xs"
											}`}
										>
											<p className="whitespace-pre-wrap">{msg.content}</p>

											{/* Interactive Tour Action Button */}
											{msg.tourId && (
												<div className="mt-2.5 pt-2 border-t border-line/60">
													<button
														type="button"
														onClick={() => handleStartGuidedTour(msg.tourId!)}
														className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-accent text-white px-3 py-1.5 font-mono text-xs font-bold shadow-2xs hover:bg-accent/90 transition cursor-pointer"
													>
														<Play className="size-3 fill-current" />
														<span>{msg.tourLabel || "Chỉ từng bước trên màn hình"}</span>
													</button>
												</div>
											)}

											{/* External CLI / Terminal Instruction Box */}
											{msg.externalSnippet && (
												<div className="mt-2.5 rounded-lg border border-line bg-paper-2 p-2.5 space-y-1.5 font-mono text-[11px]">
													<div className="flex items-center justify-between text-ink-2 text-[10px]">
														<div className="flex items-center gap-1">
															<Terminal className="size-3 text-accent" />
															<span>{msg.externalSnippet.title}</span>
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
													<pre className="p-2 rounded bg-white border border-line/60 text-ink overflow-x-auto text-[10.5px]">
														<code>{msg.externalSnippet.code}</code>
													</pre>
													{msg.externalSnippet.hint && (
														<p className="text-[10px] text-ink-2/80 font-sans italic">
															{msg.externalSnippet.hint}
														</p>
													)}
												</div>
											)}
										</div>
									</div>
								))}
								<div ref={messagesEndRef} />
							</div>

							{/* Quick Suggestions Strip */}
							<div className="border-t border-line/70 bg-white px-3 py-2">
								<div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
									{SUGGESTIONS.map((s, idx) => (
										<button
											key={idx}
											type="button"
											onClick={() => handleSend(s.query)}
											className="shrink-0 rounded-full border border-line bg-paper/60 px-2.5 py-1 font-mono text-[10.5px] text-ink-2 hover:border-accent hover:text-accent transition cursor-pointer"
										>
											{s.label}
										</button>
									))}
								</div>
							</div>

							{/* Input Bar */}
							<form
								onSubmit={(e) => {
									e.preventDefault();
									handleSend();
								}}
								className="flex items-center gap-1.5 border-t border-line bg-white p-2.5"
							>
								<input
									type="text"
									value={input}
									onChange={(e) => setInput(e.target.value)}
									placeholder="Hỏi bất cứ điều gì về mnRouter..."
									className="flex-1 rounded-lg border border-line bg-paper/30 px-3 py-1.5 text-xs text-ink placeholder:text-ink-2/60 focus:outline-none focus:border-accent font-sans"
								/>
								<button
									type="submit"
									disabled={!input.trim()}
									className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition ${
										input.trim()
											? "bg-accent text-white hover:bg-accent/90 cursor-pointer shadow-2xs"
											: "bg-paper-2 text-ink-2/40 cursor-not-allowed"
									}`}
								>
									<SendHorizontal className="size-4" />
								</button>
							</form>
						</motion.div>
					)}
				</AnimatePresence>
			</motion.div>
		</>
	);
}

// Intelligent helper response resolver
function resolveCopilotReply(query: string): CopilotMessage {
	const q = query.toLowerCase();

	// 1. API Keys Guide
	if (q.includes("api key") || q.includes("tạo key") || q.includes("lấy key") || q.includes("key bí mật")) {
		return {
			id: String(Date.now()),
			role: "assistant",
			content: "Để tạo API Key kết nối vào các công cụ AI bên ngoài, ní vào trang API Keys, bấm '+ Create API key', đặt tên mô tả rồi lưu mã key 'mr_...' lại nhé. Bấm nút dưới đây để tui làm mờ màn hình và khoanh vùng chỉ từng bước cho ní luôn nè:",
			tourId: "create-api-key",
			tourLabel: "▶ Chỉ từng bước tạo API Key",
		};
	}

	// 2. Tools Config (Codex, Claude, OMP)
	if (q.includes("codex") || q.includes("claude code") || q.includes("omp") || q.includes("cấu hình") || q.includes("config")) {
		return {
			id: String(Date.now()),
			role: "assistant",
			content: "Trang Tools Config có sẵn script 1-Click tự động cài đặt models, token và router URL cho máy tính của ní (hỗ trợ cả macOS/Linux và Windows PowerShell). Ní có thể bấm nút dưới để xem hướng dẫn trực tiếp, hoặc copy lệnh Terminal bên dưới chạy thử nha:",
			tourId: "tools-config",
			tourLabel: "▶ Chỉ từng bước cài Tools",
			externalSnippet: {
				title: "Terminal Command (Cài Codex 1-Click)",
				code: "curl -s https://mnrouter.mncuchiinhuttt.dev/api/setup/codex | bash",
				hint: "Mở Terminal trên máy tính của bạn, dán dòng lệnh trên vào và ấn Enter để tự động cài đặt.",
			},
		};
	}

	// 3. Chat & Models
	if (q.includes("chat") || q.includes("model") || q.includes("context") || q.includes("thu gọn")) {
		return {
			id: String(Date.now()),
			role: "assistant",
			content: "Không gian Chat & Agent hỗ trợ hơn 40 models đỉnh cao (Claude, Gemini, Codex, Grok, Muse Spark...) kèm phân tích tài liệu và nén ngữ cảnh. Bấm nút dưới để tui dẫn ní qua xem các vị trí điều khiển nha:",
			tourId: "chat-workspace",
			tourLabel: "▶ Xem hướng dẫn Chat & Model",
		};
	}

	// 4. Server Status
	if (q.includes("status") || q.includes("trạng thái") || q.includes("uptime") || q.includes("hoạt động")) {
		return {
			id: String(Date.now()),
			role: "assistant",
			content: "Trang Server Status cho phép ní theo dõi tình trạng hoạt động thời gian thực của các nhà cung cấp, kiểm tra uptime 30 ngày và lịch sử bảo trì.",
			tourId: "server-status",
			tourLabel: "▶ Mở Server Status",
		};
	}

	// 5. Invitations (Admin)
	if (q.includes("mời") || q.includes("invite") || q.includes("thành viên") || q.includes("user")) {
		return {
			id: String(Date.now()),
			role: "assistant",
			content: "Tính năng Mời thành viên cho phép quản trị viên nhập nhiều email cùng lúc (gõ email bấm Enter hoặc dán danh sách từ Excel) để cấp chung gói tài nguyên và danh sách model được phép sử dụng.",
			tourId: "invite-members",
			tourLabel: "▶ Xem cách mời nhiều người",
		};
	}

	// 6. Telegram Bot
	if (q.includes("telegram") || q.includes("bot") || q.includes("lệnh")) {
		return {
			id: String(Date.now()),
			role: "assistant",
			content: "Bot Telegram @mnrouter_bot hỗ trợ nhận thông báo lỗi, cooldown và cho phép tra cứu thông tin máy chủ qua bộ Slash Commands. Đây là các lệnh phổ biến ní có thể dùng trực tiếp trên Telegram:",
			externalSnippet: {
				title: "Telegram Slash Commands",
				code: "/status - Xem sức khoẻ máy chủ\n/usage - Xem lưu lượng tokens trong ngày\n/quotas - Kiểm tra hạn mức các hãng\n/logs - Xem 5 lượt request gần nhất\n/invite <email> [gói] - Tạo link mời ngay trên chat",
				hint: "Mở ứng dụng Telegram, tìm @mnrouter_bot và gõ ký tự / để xem toàn bộ danh sách lệnh.",
			},
		};
	}

	// Default fallback
	return {
		id: String(Date.now()),
		role: "assistant",
		content: "Tui có thể hướng dẫn ní về: Tạo API Key, Cấu hình Tools (Codex/Claude), Sử dụng Chat, Xem trạng thái Server hoặc Mời thành viên mới. Ní muốn tui chỉ dẫn phần nào cứ bấm vào các gợi ý bên dưới nha!",
	};
}
