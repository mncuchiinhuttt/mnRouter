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
	startCustomTour: (tour: TourDefinition) => void;
	nextStep: () => void;
	prevStep: () => void;
	endTour: () => void;
	isTourActive: boolean;
}

export const TOURS: Record<string, TourDefinition> = {
	"update-profile": {
		id: "update-profile",
		title: "Đổi tên hiển thị",
		description: "Cập nhật tên và thông tin tài khoản cá nhân.",
		steps: [
			{
				targetSelector: '[data-tour="user-profile-btn"]',
				title: "Mở menu tài khoản",
				instruction: "Bấm vào ảnh đại diện hoặc tên của bạn ở góc dưới cùng menu bên trái.",
				placement: "right",
			},
			{
				targetSelector: '[data-tour="user-display-name-input"]',
				title: "Nhập tên mới và Lưu",
				instruction: "Nhập Tên hiển thị mới vào ô này rồi nhấn nút 'Lưu thay đổi'.",
				placement: "top",
			},
		],
	},
	"create-api-key": {
		id: "create-api-key",
		title: "Cách tạo API Key",
		description: "Hướng dẫn tạo khoá bí mật để kết nối các công cụ AI CLI & IDE.",
		steps: [
			{
				targetSelector: '[data-tour="nav-keys"]',
				title: "Bước 1: Mở trang API Keys",
				instruction: "Bấm vào mục API KEYS ở thanh menu bên trái.",
				placement: "right",
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

function findVisibleElement(selector: string): HTMLElement | null {
	const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
	if (elements.length === 0) return null;

	for (const el of elements) {
		const rect = el.getBoundingClientRect();
		if (rect.width > 0 && rect.height > 0) {
			const style = window.getComputedStyle(el);
			if (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0") {
				return el;
			}
		}
	}
	return elements[0] ?? null;
}

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

		const el = findVisibleElement(currentStep.targetSelector);
		if (el) {
			const rect = el.getBoundingClientRect();
			if (rect.width > 0 && rect.height > 0) {
				setTargetRect(rect);
				return;
			}
		}
		setTargetRect(null);
	}, [currentStep]);
	// Auto-advance when route changes to target page
	useEffect(() => {
		if (!activeTour || currentStepIndex !== 0) return;
		if (activeTour.id === "create-api-key" && location.pathname === "/keys") {
			setCurrentStepIndex(1);
		} else if (activeTour.id === "tools-config" && location.pathname === "/config") {
			setCurrentStepIndex(1);
		} else if (activeTour.id === "chat-workspace" && location.pathname === "/chat") {
			setCurrentStepIndex(1);
		} else if (activeTour.id === "server-status" && location.pathname === "/status") {
			setCurrentStepIndex(1);
		} else if (activeTour.id === "invite-members" && location.pathname === "/admin/users") {
			setCurrentStepIndex(1);
		}
	}, [location.pathname, activeTour, currentStepIndex]);

	// Track target element rect smoothly on resize and scroll
	useEffect(() => {
		if (!activeTour) return;
		updateRect();
		const timer = setTimeout(updateRect, 150);

		let ticking = false;
		const onScrollOrResize = () => {
			if (!ticking) {
				window.requestAnimationFrame(() => {
					updateRect();
					ticking = false;
				});
				ticking = true;
			}
		};

		window.addEventListener("resize", onScrollOrResize);
		window.addEventListener("scroll", onScrollOrResize, true);

		return () => {
			clearTimeout(timer);
			window.removeEventListener("resize", onScrollOrResize);
			window.removeEventListener("scroll", onScrollOrResize, true);
		};
	}, [activeTour, updateRect]);
	const startTour = useCallback((tourId: string) => {
		const def = TOURS[tourId];
		if (!def) return;
		setActiveTour(def);

		// If user is already on the target route, start directly at step 2!
		let startIdx = 0;
		if (tourId === "create-api-key" && location.pathname === "/keys") startIdx = 1;
		else if (tourId === "tools-config" && location.pathname === "/config") startIdx = 1;
		else if (tourId === "chat-workspace" && location.pathname === "/chat") startIdx = 1;
		else if (tourId === "server-status" && location.pathname === "/status") startIdx = 1;
		else if (tourId === "invite-members" && location.pathname === "/admin/users") startIdx = 1;

		setCurrentStepIndex(startIdx);
	}, [location.pathname]);

	const startCustomTour = useCallback((tour: TourDefinition) => {
		if (!tour || !tour.steps || tour.steps.length === 0) return;
		setActiveTour(tour);

		let startIdx = 0;
		if (tour.steps.length > 1) {
			const firstTarget = findVisibleElement(tour.steps[0]?.targetSelector || "");
			const secondTarget = findVisibleElement(tour.steps[1]?.targetSelector || "");
			if (secondTarget && !firstTarget) {
				startIdx = 1;
			}
		}

		setCurrentStepIndex(startIdx);
	}, []);
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

	// Automatically advance when the user clicks the spotlighted target element
	useEffect(() => {
		if (!activeTour || !currentStep) return;

		const handleTargetClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement | null;
			if (!target) return;

			if (target.closest(currentStep.targetSelector)) {
				if (currentStep.targetSelector.includes("user-profile-btn")) {
					window.dispatchEvent(new CustomEvent("open-user-settings"));
				}
				setTimeout(() => {
					nextStep();
				}, 150);
			}
		};

		document.addEventListener("click", handleTargetClick, true);
		return () => document.removeEventListener("click", handleTargetClick, true);
	}, [activeTour, currentStep, nextStep]);
	return (
		<TourContext.Provider
			value={{
				activeTour,
				currentStepIndex,
				currentStep,
				startTour,
				startCustomTour,
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
					<div className="fixed inset-0 z-[9998] pointer-events-none">
						{/* Hardware-accelerated Spotlight & Backdrop */}
						{targetRect ? (
							<div
								style={{
									top: Math.max(0, targetRect.top - 6),
									left: Math.max(0, targetRect.left - 6),
									width: targetRect.width + 12,
									height: targetRect.height + 12,
									boxShadow: "0 0 0 9999px rgba(10, 15, 30, 0.60)",
								}}
								onClick={(e) => {
									e.stopPropagation();
									const el = findVisibleElement(currentStep.targetSelector);
									if (el) el.click();
									setTimeout(() => {
										nextStep();
									}, 150);
								}}
								className="absolute rounded-lg ring-4 ring-accent pointer-events-auto cursor-pointer transition-all duration-200"
								title="Bấm vào đây để tiếp tục"
							>
								<span className="absolute -top-1 -right-1 size-3 rounded-full bg-accent animate-ping" />
							</div>
						) : (
							<div
								className="absolute inset-0 bg-navy/60 pointer-events-auto"
								onClick={endTour}
							/>
						)}

						{/* Floating Step Card (High-Craft Dark HUD Design) */}
						<div
							style={{
								position: "fixed",
								...(targetRect
									? calculateCardPosition(targetRect, currentStep.placement)
									: { bottom: 30, right: 30 }),
							}}
							className="z-[9999] w-[310px] max-w-[calc(100vw-32px)] rounded-xl border border-white/15 bg-navy/95 backdrop-blur-xl p-3.5 shadow-2xl text-white font-mono text-xs space-y-2.5 transition-all duration-300 pointer-events-auto"
						>
							{/* Top Micro Header */}
							<div className="flex items-center justify-between border-b border-white/10 pb-2">
								<div className="flex items-center gap-1.5 min-w-0">
									<span className="text-[10px] uppercase font-bold tracking-widest text-accent shrink-0">
										STEP {currentStepIndex + 1}/{activeTour.steps.length}
									</span>
									<span className="text-white/30">&middot;</span>
									<span className="text-[11px] font-semibold text-white truncate">
										{activeTour.title}
									</span>
								</div>
								<button
									onClick={endTour}
									className="rounded p-1 text-white/60 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0 ml-1"
									title="Đóng hướng dẫn"
								>
									<X className="size-3.5" />
								</button>
							</div>

							{/* Step Content */}
							<div className="space-y-1">
								<h4 className="font-semibold text-xs text-white">
									{currentStep.title}
								</h4>
								<p className="text-[11px] text-[#b9b9dd] leading-relaxed font-sans">
									{currentStep.instruction}
								</p>
								{currentStep.actionNote && (
									<p className="text-[10px] text-accent/90 italic font-sans pt-0.5">
										{currentStep.actionNote}
									</p>
								)}
							</div>

							{/* Dynamic Action Footer */}
							<div className="pt-2 border-t border-white/10">
								{currentStepIndex === activeTour.steps.length - 1 ? (
									<button
										onClick={endTour}
										className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-accent py-1.5 text-xs font-bold text-white shadow-xs hover:bg-accent/90 transition cursor-pointer"
									>
										<CheckCircle2 className="size-3.5" />
										<span>Hoàn thành</span>
									</button>
								) : (
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-1.5 font-mono text-[10px] text-accent font-medium">
											<span className="size-1.5 rounded-full bg-accent animate-ping shrink-0" />
											<span className="truncate">Nhấp vào ô khoanh viền</span>
										</div>
										<button
											onClick={endTour}
											className="text-[10.5px] text-white/50 hover:text-white transition cursor-pointer shrink-0"
										>
											Bỏ qua
										</button>
									</div>
								)}
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

function calculateCardPosition(target: DOMRect | null, placement: TourStep["placement"] = "bottom") {
	const margin = 16;
	const cardWidth = 340;
	const cardHeight = 220;

	const viewportW = window.innerWidth;
	const viewportH = window.innerHeight;

	// Center card if target is not visible or has zero size
	if (!target || (target.width === 0 && target.height === 0)) {
		return {
			top: Math.max(20, (viewportH - cardHeight) / 2),
			left: Math.max(20, (viewportW - cardWidth) / 2),
		};
	}

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
