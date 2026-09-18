import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, ArrowRight, ArrowLeft, X, CheckCircle2 } from "lucide-react";

export interface TourStep {
	targetSelector: string;
	title: string;
	instruction: string;
	route?: string;
	placement?: "top" | "bottom" | "left" | "right";
	actionNote?: string;
}

export interface TourDefinition {
	id: string;
	title: string;
	description: string;
	steps: TourStep[];
}

interface TourContextValue {
	activeTour: TourDefinition | null;
	currentStepIndex: number;
	currentStep: TourStep | null;
	startTour: (tourId: string) => void;
	nextStep: () => void;
	prevStep: () => void;
	endTour: () => void;
	isTourActive: boolean;
}

export const TOURS: Record<string, TourDefinition> = {
	"create-api-key": {
		id: "create-api-key",
		title: "Cách tạo API Key",
		description: "Hướng dẫn tạo khoá bí mật để kết nối các công cụ AI CLI & IDE.",
		steps: [
			{
				targetSelector: '[data-tour="nav-keys"]',
				route: "/keys",
				title: "Bước 1: Mở trang API Keys",
				instruction: "Bấm vào mục API KEYS ở thanh menu bên trái để truy cập trang quản lý khoá bí mật.",
				placement: "right",
				actionNote: "Bấm vào mục này hoặc nút Tiếp theo để đi đến trang Quản lý khoá.",
			},
			{
				targetSelector: '[data-tour="create-key-btn"]',
				route: "/keys",
				title: "Bước 2: Bấm Tạo khoá mới",
				instruction: "Tại góc trên bên phải trang API Keys, bấm vào nút '+ Create API key' để mở hộp thoại tạo khoá.",
				placement: "bottom",
				actionNote: "Bấm nút '+ Create API key' để tiếp tục.",
			},
			{
				targetSelector: '[data-tour="key-name-input"]',
				route: "/keys",
				title: "Bước 3: Đặt tên và Tạo khoá",
				instruction: "Nhập tên dễ nhớ cho khoá (ví dụ: Claude Code, Cursor, Mac Mini...) rồi bấm Tạo. Sau khi tạo, hãy sao chép mã key 'mr_...' lưu lại vì nó chỉ hiển thị 1 lần duy nhất!",
				placement: "bottom",
			},
		],
	},
	"tools-config": {
		id: "tools-config",
		title: "Cấu hình Tools (Codex, Claude, OMP)",
		description: "Hướng dẫn lấy script tự động nạp cấu hình vào máy của bạn.",
		steps: [
			{
				targetSelector: '[data-tour="nav-config"]',
				route: "/config",
				title: "Bước 1: Vào mục Tools Config",
				instruction: "Bấm vào mục TOOLS CONFIG ở thanh menu bên trái.",
				placement: "right",
			},
			{
				targetSelector: '[data-tour="tool-tabs"]',
				route: "/config",
				title: "Bước 2: Chọn công cụ của bạn",
				instruction: "Chọn tab công cụ bạn muốn kết nối: Codex CLI, Claude Code, Oh My Pi (OMP), hoặc Pi Agent.",
				placement: "bottom",
			},
			{
				targetSelector: '[data-tour="copy-script-btn"]',
				route: "/config",
				title: "Bước 3: Copy Script cấu hình 1-Click",
				instruction: "Bấm nút 'Copy script' rồi dán vào Terminal trên máy tính của bạn và ấn Enter. Toàn bộ models, token và router URL sẽ được tự động cài đặt!",
				placement: "top",
			},
		],
	},
	"chat-workspace": {
		id: "chat-workspace",
		title: "Trải nghiệm Chat & Đổi Model",
		description: "Hướng dẫn sử dụng không gian trò chuyện AI đa model.",
		steps: [
			{
				targetSelector: '[data-tour="nav-chat"]',
				route: "/chat",
				title: "Bước 1: Vào Chat & Agent",
				instruction: "Bấm vào mục CHAT & AGENT ở thanh menu bên trái.",
				placement: "right",
			},
			{
				targetSelector: '[data-tour="model-selector"]',
				route: "/chat",
				title: "Bước 2: Lựa chọn Model AI",
				instruction: "Bấm vào menu chọn model để đổi giữa các dòng model hàng đầu: Claude 3.7 / 3.5, Gemini 3.8 / 3.7 Flash, GPT-6 Astra, Muse Spark...",
				placement: "top",
			},
			{
				targetSelector: '[data-tour="chat-context-pill"]',
				route: "/chat",
				title: "Bước 3: Giám sát & Thu gọn Ngữ cảnh",
				instruction: "Rê chuột vào ô Context để xem dung lượng bộ nhớ đã dùng và bấm 'Compact' khi cần tóm tắt cuộc trò chuyện dài để tiết kiệm token.",
				placement: "top",
			},
		],
	},
	"server-status": {
		id: "server-status",
		title: "Kiểm tra Trạng thái Server",
		description: "Xem tình trạng hoạt động và độ ổn định của mnRouter.",
		steps: [
			{
				targetSelector: '[data-tour="nav-status"]',
				route: "/status",
				title: "Bước 1: Mở Server Status",
				instruction: "Bấm vào mục SERVER STATUS ở nhóm SYSTEM trên thanh menu.",
				placement: "right",
			},
			{
				targetSelector: '[data-tour="services-health"]',
				route: "/status",
				title: "Bước 2: Giám sát Dịch vụ & Uptime 30 ngày",
				instruction: "Theo dõi tình trạng hoạt động thời gian thực của từng hãng (Antigravity, Claude, Codex, Database) và lịch sử uptime 30 ngày.",
				placement: "bottom",
			},
		],
	},
	"invite-members": {
		id: "invite-members",
		title: "Mời thành viên mới (Admin)",
		description: "Hướng dẫn gửi lời mời tham gia mnRouter cho đồng nghiệp.",
		steps: [
			{
				targetSelector: '[data-tour="nav-users"]',
				route: "/admin/users",
				title: "Bước 1: Vào Quản lý Người dùng",
				instruction: "Bấm vào mục USERS trong nhóm ADMIN trên menu bên trái.",
				placement: "right",
			},
			{
				targetSelector: '[data-tour="invite-btn"]',
				route: "/admin/users",
				title: "Bước 2: Mở hộp thoại Mời",
				instruction: "Bấm vào nút 'Send invitation' ở góc trên bên phải.",
				placement: "bottom",
			},
			{
				targetSelector: '[data-tour="invite-emails"]',
				route: "/admin/users",
				title: "Bước 3: Nhập danh sách Email",
				instruction: "Gõ email và bấm Enter để tạo tag, hoặc dán cả danh sách email từ Excel/Sheets. Tất cả người dùng sẽ nhận chung cấu hình gói và hạn mức!",
				placement: "bottom",
			},
		],
	},
};

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
	const [activeTour, setActiveTour] = useState<TourDefinition | null>(null);
	const [currentStepIndex, setCurrentStepIndex] = useState(0);
	const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
	const navigate = useNavigate();
	const location = useLocation();

	const currentStep = activeTour?.steps[currentStepIndex] ?? null;

	const endTour = useCallback(() => {
		setActiveTour(null);
		setCurrentStepIndex(0);
		setTargetRect(null);
	}, []);

	const updateRect = useCallback(() => {
		if (!currentStep) {
			setTargetRect(null);
			return;
		}

		const el = document.querySelector(currentStep.targetSelector);
		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "nearest" });
			const rect = el.getBoundingClientRect();
			setTargetRect(rect);
		} else {
			setTargetRect(null);
		}
	}, [currentStep]);

	// Navigate route if required
	useEffect(() => {
		if (!currentStep) return;
		if (currentStep.route && location.pathname !== currentStep.route) {
			navigate(currentStep.route);
		}
	}, [currentStep, location.pathname, navigate]);

	// Track target element rect on change, scroll, and resize
	useEffect(() => {
		updateRect();
		const timer = setTimeout(updateRect, 300);
		const interval = setInterval(updateRect, 600);

		window.addEventListener("resize", updateRect);
		window.addEventListener("scroll", updateRect, true);

		return () => {
			clearTimeout(timer);
			clearInterval(interval);
			window.removeEventListener("resize", updateRect);
			window.removeEventListener("scroll", updateRect, true);
		};
	}, [updateRect]);

	const startTour = useCallback((tourId: string) => {
		const def = TOURS[tourId];
		if (!def) return;
		setActiveTour(def);
		setCurrentStepIndex(0);
		if (def.steps[0]?.route && location.pathname !== def.steps[0].route) {
			navigate(def.steps[0].route);
		}
	}, [location.pathname, navigate]);

	const nextStep = useCallback(() => {
		if (!activeTour) return;
		if (currentStepIndex < activeTour.steps.length - 1) {
			const nextIdx = currentStepIndex + 1;
			setCurrentStepIndex(nextIdx);
			const nextS = activeTour.steps[nextIdx];
			if (nextS?.route && location.pathname !== nextS.route) {
				navigate(nextS.route);
			}
		} else {
			endTour();
		}
	}, [activeTour, currentStepIndex, location.pathname, navigate, endTour]);

	const prevStep = useCallback(() => {
		if (!activeTour || currentStepIndex === 0) return;
		const prevIdx = currentStepIndex - 1;
		setCurrentStepIndex(prevIdx);
		const prevS = activeTour.steps[prevIdx];
		if (prevS?.route && location.pathname !== prevS.route) {
			navigate(prevS.route);
		}
	}, [activeTour, currentStepIndex, location.pathname, navigate]);

	return (
		<TourContext.Provider
			value={{
				activeTour,
				currentStepIndex,
				currentStep,
				startTour,
				nextStep,
				prevStep,
				endTour,
				isTourActive: Boolean(activeTour),
			}}
		>
			{children}

			{/* Spotlight & Blur Overlay */}
			<AnimatePresence>
				{activeTour && currentStep && (
					<div className="fixed inset-0 z-[9998] pointer-events-auto">
						{/* Blurred darkened backdrop */}
						<div
							className="absolute inset-0 bg-navy/60 backdrop-blur-[2px] transition-all duration-300"
							onClick={endTour}
						/>

						{/* Cutout Spotlight on Target Element */}
						{targetRect && (
							<div
								style={{
									top: targetRect.top - 6,
									left: targetRect.left - 6,
									width: targetRect.width + 12,
									height: targetRect.height + 12,
								}}
								className="absolute rounded-lg ring-4 ring-accent shadow-[0_0_0_9999px_rgba(10,15,30,0.65)] pointer-events-none transition-all duration-300"
							>
								{/* Glowing corner pulse */}
								<span className="absolute -top-1 -right-1 size-3 rounded-full bg-accent animate-ping" />
							</div>
						)}

						{/* Floating Step Card */}
						<div
							style={{
								position: "fixed",
								...(targetRect
									? calculateCardPosition(targetRect, currentStep.placement)
									: { bottom: 30, right: 30 }),
							}}
							className="z-[9999] w-[340px] max-w-[calc(100vw-32px)] rounded-xl border border-line bg-white p-4 shadow-2xl space-y-3 font-mono text-xs transition-all duration-300"
						>
							{/* Header */}
							<div className="flex items-center justify-between border-b border-line/60 pb-2">
								<div className="flex items-center gap-1.5 font-semibold text-ink">
									<Sparkles className="size-3.5 text-accent" />
									<span>{activeTour.title}</span>
								</div>
								<div className="flex items-center gap-2">
									<span className="text-[10px] text-ink-2 bg-paper-2 border border-line px-1.5 py-0.5 rounded font-bold">
										{currentStepIndex + 1}/{activeTour.steps.length}
									</span>
									<button
										onClick={endTour}
										className="rounded p-1 text-ink-2 hover:bg-black/5 hover:text-ink transition cursor-pointer"
										title="Đóng hướng dẫn"
									>
										<X className="size-3.5" />
									</button>
								</div>
							</div>

							{/* Step Content */}
							<div>
								<h4 className="font-bold text-sm text-ink mb-1">
									{currentStep.title}
								</h4>
								<p className="text-xs text-ink-2 leading-relaxed font-sans">
									{currentStep.instruction}
								</p>
								{currentStep.actionNote && (
									<p className="mt-1.5 text-[11px] text-accent/90 italic font-sans">
										{currentStep.actionNote}
									</p>
								)}
							</div>

							{/* Footer Navigation Buttons */}
							<div className="flex items-center justify-between pt-2 border-t border-line/60">
								<button
									onClick={prevStep}
									disabled={currentStepIndex === 0}
									className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
										currentStepIndex === 0
											? "text-ink-2/40 cursor-not-allowed"
											: "text-ink hover:bg-paper-2"
									}`}
								>
									<ArrowLeft className="size-3" />
									<span>Trước</span>
								</button>

								<button
									onClick={nextStep}
									className="inline-flex items-center gap-1 rounded bg-accent px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-accent/90 transition cursor-pointer"
								>
									{currentStepIndex === activeTour.steps.length - 1 ? (
										<>
											<CheckCircle2 className="size-3" />
											<span>Hoàn thành</span>
										</>
									) : (
										<>
											<span>Tiếp theo</span>
											<ArrowRight className="size-3" />
										</>
									)}
								</button>
							</div>
						</div>
					</div>
				)}
			</AnimatePresence>
		</TourContext.Provider>
	);
}

export function useTour() {
	const ctx = useContext(TourContext);
	if (!ctx) throw new Error("useTour must be used within TourProvider");
	return ctx;
}

function calculateCardPosition(target: DOMRect, placement: TourStep["placement"] = "bottom") {
	const margin = 16;
	const cardWidth = 340;
	const cardHeight = 200;

	const viewportW = window.innerWidth;
	const viewportH = window.innerHeight;

	let top = target.bottom + margin;
	let left = target.left;

	if (placement === "top") {
		top = target.top - cardHeight - margin;
	} else if (placement === "right") {
		top = target.top;
		left = target.right + margin;
	} else if (placement === "left") {
		top = target.top;
		left = target.left - cardWidth - margin;
	}

	// Boundary guards
	if (left + cardWidth > viewportW - 16) {
		left = viewportW - cardWidth - 16;
	}
	if (left < 16) left = 16;

	if (top + cardHeight > viewportH - 16) {
		top = viewportH - cardHeight - 16;
	}
	if (top < 16) top = 16;

	return { top, left };
}
