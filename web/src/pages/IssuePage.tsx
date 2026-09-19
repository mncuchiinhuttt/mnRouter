import { useState, useRef, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	AlertTriangle,
	ArrowRight,
	CheckCircle2,
	Clock,
	ExternalLink,
	HelpCircle,
	Image as ImageIcon,
	Plus,
	Send,
	ShieldCheck,
	Sparkles,
	Terminal,
	Trash2,
	UploadCloud,
	Wrench,
	X,
} from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Badge, Input } from "@web/components/ui/primitives";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@web/components/ui/select";
import { cn } from "@web/lib/utils";
interface IssueImage {
	id: string;
	filename: string;
	sizeBytes: number;
	mimeType: string;
	createdAt: string;
}

interface IssueItem {
	id: string;
	title: string;
	description: string;
	tool: string;
	customTool: string | null;
	model: string | null;
	status: "open" | "investigating" | "resolved";
	adminNote: string | null;
	userEmail: string | null;
	createdAt: string;
	images: IssueImage[];
}

const PLATFORM_OPTIONS = [
	{ id: "claude_code", name: "Claude Code", category: "CLI Harness", icon: "/harnesses/claude.png", desc: "Anthropic Claude Code CLI workspace" },
	{ id: "claude_cowork", name: "Claude Cowork", category: "Desktop & Agent", icon: "/harnesses/claude.png", desc: "Claude Desktop and Cowork agent" },
	{ id: "codex", name: "OpenAI Codex", category: "CLI Harness", icon: "/harnesses/codex.png", desc: "OpenAI Codex CLI & /v1/responses" },
	{ id: "openclaw", name: "OpenClaw", category: "Autonomous Agent", icon: "/harnesses/openclaw.png", desc: "OpenClaw autonomous coding agent" },
	{ id: "opencode", name: "OpenCode", category: "CLI Harness", icon: "/harnesses/opencode.png", desc: "OpenCode CLI / Zen coding runner" },
	{ id: "hermes", name: "Hermes Agent", category: "Autonomous Agent", icon: "/harnesses/hermes.png", desc: "Hermes Multi-Agent Framework" },
	{ id: "cursor", name: "Cursor / Windsurf", category: "Editor & IDE", icon: "/harnesses/cursor.png", desc: "Cursor IDE OpenAI Base URL override" },
	{ id: "grok_build", name: "Grok Build", category: "xAI Terminal Agent", icon: "/harnesses/grok.png", desc: "xAI Grok Build CLI coding agent" },
	{ id: "dsh", name: "DSH", category: "Official Web & Headless", icon: "/harnesses/deepseek-tui.png", desc: "DeepSeek Harness official CLI & Web UI" },
	{ id: "pi", name: "Pi", category: "CLI Harness", icon: "/harnesses/pi.svg", desc: "Pi CLI coding agent harness" },
	{ id: "omp", name: "Oh My Pi (OMP)", category: "Multi-Agent Harness", icon: "/harnesses/omp.svg", desc: "OMP multi-agent runtime & extensions" },
	{ id: "zcode", name: "ZCode", category: "Editor & IDE", icon: "/harnesses/zcode.webp", desc: "Custom model provider in ZCode" },
	{ id: "github_copilot", name: "GitHub Copilot (VS Code)", category: "VS Code Extension", icon: "/harnesses/copilot.png", desc: "Native Copilot Chat via 9Router extension" },
	{ id: "antigravity", name: "Antigravity (MITM Proxy)", category: "MITM Proxy", icon: "/harnesses/antigravity.png", desc: "Google Cloud Code interception proxy" },
	{ id: "kiro", name: "Kiro (MITM Proxy)", category: "MITM Proxy", icon: "/harnesses/kiro.png", desc: "AWS CodeWhisperer interception proxy" },
	{ id: "chat", name: "Chat & Agent Web", category: "Web Interface", icon: "/harnesses/chat-isometric.svg", desc: "mnRouter internal web chat interface" },
	{ id: "api", name: "Direct API", category: "Direct API", icon: "/harnesses/api-isometric.svg", desc: "cURL, Python SDK, OpenAI/Anthropic SDK" },
	{ id: "other", name: "Khác / Custom Tool", category: "Khác", icon: "", desc: "Công cụ, script hoặc môi trường client khác" },
];

export default function IssuePage() {
	const { t, i18n } = useTranslation();
	const isVi = i18n.language?.startsWith("vi");

	const [tool, setTool] = useState<string>("claude_code");
	const [customTool, setCustomTool] = useState("");
	const [title, setTitle] = useState("");
	const [model, setModel] = useState("");
	const [description, setDescription] = useState("");
	const [email, setEmail] = useState("");
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [submittedIssue, setSubmittedIssue] = useState<IssueItem | null>(null);

	const fileInputRef = useRef<HTMLInputElement | null>(null);

	// Fetch models list for optional select/autocomplete
	const { data: modelsData } = useQuery({
		queryKey: ["models-list-issue"],
		queryFn: () => api<{ models: Array<{ id: string; name?: string }> }>("/v1/models").catch(() => ({ models: [] })),
		staleTime: 60_000,
	});

	// Fetch current user if logged in
	const { data: meData } = useQuery({
		queryKey: ["me-issue"],
		queryFn: () => api<{ me: { id: string; email: string; displayName?: string } }>("/api/me").catch(() => ({ me: null })),
	});

	// User's recent reported issues
	const { data: myIssuesData, refetch: refetchMyIssues } = useQuery({
		queryKey: ["my-issues"],
		queryFn: () => api<{ issues: IssueItem[] }>("/api/issues/my").catch(() => ({ issues: [] })),
		enabled: Boolean(meData?.me),
	});

	const submitMutation = useMutation({
		mutationFn: async () => {
			const formData = new FormData();
			formData.append("tool", tool);
			if (customTool) formData.append("customTool", customTool.trim());
			formData.append("title", title.trim());
			formData.append("description", description.trim());
			if (model) formData.append("model", model.trim());
			if (email) formData.append("email", email.trim());

			for (const f of selectedFiles) {
				formData.append("images", f);
			}

			const res = await fetch("/api/issues", {
				method: "POST",
				body: formData,
				credentials: "include",
			});
			const json = await res.json();
			if (!res.ok) {
				throw new Error(json.error?.message || json.error || "Gửi báo cáo thất bại");
			}
			return json.data as IssueItem;
		},
		onSuccess: (data) => {
			toast.success(isVi ? "Đã gửi báo cáo sự cố thành công!" : "Issue reported successfully!");
			setSubmittedIssue(data);
			setTitle("");
			setDescription("");
			setCustomTool("");
			setSelectedFiles([]);
			refetchMyIssues();
		},
		onError: (err: Error) => {
			toast.error(err.message);
		},
	});

	const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
		if (!e.target.files) return;
		const files = Array.from(e.target.files);
		const valid = files.filter((f) => {
			if (!f.type.startsWith("image/")) {
				toast.error(`${f.name} không phải là file hình ảnh hợp lệ`);
				return false;
			}
			if (f.size > 10 * 1024 * 1024) {
				toast.error(`${f.name} vượt quá dung lượng tối đa 10MB`);
				return false;
			}
			return true;
		});

		setSelectedFiles((prev) => [...prev, ...valid].slice(0, 8));
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const removeFile = (idx: number) => {
		setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
	};

	return (
		<div className="mx-auto max-w-5xl space-y-8 py-4 pb-20">
			{/* Luxury Minimalist Hero Header */}
			<header className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-white via-paper to-paper p-7 sm:p-9 shadow-xs">
				<div className="flex flex-col gap-3">
					<div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-xs font-mono font-medium text-accent w-fit">
						<span className="size-1.5 rounded-full bg-accent animate-pulse" />
						<span>mnRouter Incident Dispatch</span>
					</div>
					<h1 className="text-3xl font-bold tracking-tight text-ink sm:text-[38px] leading-tight">
						{isVi ? "Báo cáo sự cố & Lỗi kỹ thuật" : "Submit Incident Report"}
					</h1>
					<p className="max-w-2xl text-sm leading-relaxed text-ink-2">
						{isVi
							? "Hỗ trợ xử lý lỗi kết nối, hạn mức quota, timeout hoặc phản hồi không mong muốn từ các CLI & Agent. Đội ngũ quản trị viên tiếp nhận và xử lý sự cố trong thời gian sớm nhất."
							: "Report quota drops, gateway timeouts, connection aborts, or CLI environment issues. Operational tickets are triaged directly by system administrators."}
					</p>
				</div>
			</header>

			{/* Success Banner if submitted */}
			{submittedIssue && (
				<div className="rounded-xl border border-[#bcd9c0] bg-[#f4faf5] p-5 shadow-xs">
					<div className="flex items-start justify-between gap-4">
						<div className="flex items-start gap-3">
							<CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#1d7a33]" />
							<div className="space-y-1">
								<h3 className="font-semibold text-sm text-[#1d7a33]">
									{isVi ? "Báo cáo của bạn đã được ghi nhận!" : "Your issue report has been registered!"}
								</h3>
								<p className="text-xs text-ink-2">
									Mã ticket: <code className="font-mono font-bold text-ink">{submittedIssue.id.slice(0, 13)}</code>. Đội ngũ admin sẽ xem xét và khắc phục sự cố này sớm nhất có thể.
								</p>
								<div className="mt-2 text-[11.5px] font-mono text-[#1d7a33]">
									Trạng thái hiện tại: <span className="uppercase font-bold">{submittedIssue.status}</span>
								</div>
							</div>
						</div>
						<button
							type="button"
							onClick={() => setSubmittedIssue(null)}
							className="text-ink-2 hover:text-ink cursor-pointer p-1"
						>
							<X className="size-4" />
						</button>
					</div>
				</div>
			)}

			<div className="grid gap-8 lg:grid-cols-12">
				{/* Main Form */}
				<section className="space-y-6 lg:col-span-8">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							if (!title.trim() || !description.trim()) {
								toast.error(isVi ? "Vui lòng nhập đầy đủ tiêu đề và mô tả sự cố" : "Please fill in title and description");
								return;
							}
							submitMutation.mutate();
						}}
						className="space-y-6 rounded-xl border border-line bg-white p-6 shadow-xs"
					>
						{/* Step 1: Platform / Tool Selection (Select Dropdown) */}
						<div className="space-y-2">
							<label className="block text-xs font-mono font-semibold uppercase tracking-wider text-ink">
								1. {isVi ? "Nền tảng / Công cụ bạn đang sử dụng" : "Platform / Tool you were using"}
							</label>

							<Select value={tool} onValueChange={(val) => setTool(val)}>
								<SelectTrigger className="h-12 text-xs font-mono bg-paper hover:bg-paper-2/70 border-line">
									<SelectValue placeholder={isVi ? "Chọn công cụ / platform..." : "Select tool / platform..."}>
										{(() => {
											const current = PLATFORM_OPTIONS.find((p) => p.id === tool);
											if (!current) return tool;
											return (
												<div className="flex items-center gap-2.5 min-w-0">
													{current.icon ? (
														<img
															src={current.icon}
															alt=""
															className={`size-5 shrink-0 object-contain rounded-xs ${current.id === "pi" ? "brightness-0" : ""}`}
															onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
														/>
													) : (
														<Wrench className="size-4 shrink-0 text-accent" />
													)}
													<span className="font-semibold text-ink text-xs truncate">{current.name}</span>
													<span className="text-[11px] text-ink-2 truncate hidden sm:inline">&middot; {current.desc}</span>
												</div>
											);
										})()}
									</SelectValue>
								</SelectTrigger>
								<SelectContent className="max-h-80">
									{PLATFORM_OPTIONS.map((p) => (
										<SelectItem key={p.id} value={p.id} className="py-2">
											<div className="flex items-center gap-2.5 min-w-0">
												{p.icon ? (
													<img
														src={p.icon}
														alt=""
														className={`size-4 shrink-0 object-contain rounded-xs ${p.id === "pi" ? "brightness-0" : ""}`}
														onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }}
													/>
												) : (
													<Wrench className="size-3.5 shrink-0 text-accent" />
												)}
												<div className="flex flex-col min-w-0 text-left">
													<span className="font-medium text-xs text-ink">{p.name}</span>
													<span className="text-[10.5px] text-ink-2 truncate">{p.desc}</span>
												</div>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							{tool === "other" && (
								<div className="pt-2">
									<Input
										value={customTool}
										onChange={(e) => setCustomTool(e.target.value)}
										placeholder={isVi ? "Nhập tên công cụ / CLI / Framework bạn đang sử dụng..." : "Enter custom tool or framework name..."}
										className="h-9 text-xs font-mono"
									/>
								</div>
							)}
						</div>

						{/* Step 2: Model & Context */}
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-1.5">
								<label className="block text-xs font-mono font-semibold uppercase tracking-wider text-ink">
									2. {isVi ? "Model AI gọi tới (tuỳ chọn)" : "AI Model Called (optional)"}
								</label>
								<Input
									value={model}
									onChange={(e) => setModel(e.target.value)}
									placeholder="e.g. gemini-3.8-flash, claude-sonnet-4.6"
									className="h-9 text-xs font-mono"
									list="models-datalist"
								/>
								<datalist id="models-datalist">
									{(modelsData?.models || []).map((m) => (
										<option key={m.id} value={m.id} />
									))}
								</datalist>
							</div>

							<div className="space-y-1.5">
								<label className="block text-xs font-mono font-semibold uppercase tracking-wider text-ink">
									{isVi ? "Email liên hệ (nếu chưa đăng nhập)" : "Contact Email (if guest)"}
								</label>
								<Input
									type="email"
									value={email || meData?.me?.email || ""}
									disabled={Boolean(meData?.me?.email)}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="email@domain.com"
									className="h-9 text-xs font-mono disabled:opacity-75 disabled:bg-paper-2"
								/>
							</div>
						</div>

						{/* Step 3: Title & Description */}
						<div className="space-y-4">
							<div className="space-y-1.5">
								<label className="block text-xs font-mono font-semibold uppercase tracking-wider text-ink">
									3. {isVi ? "Tiêu đề tóm tắt sự cố" : "Issue Summary Title"}
								</label>
								<Input
									required
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									placeholder={isVi ? "Ví dụ: Lỗi rate limit 429 liên tục khi gọi Gemini qua Claude Code" : "e.g. Rate limit 429 looping when querying Claude Code"}
									className="h-9 text-xs"
								/>
							</div>

							<div className="space-y-1.5">
								<label className="block text-xs font-mono font-semibold uppercase tracking-wider text-ink">
									4. {isVi ? "Mô tả chi tiết & Thông báo lỗi" : "Detailed Description & Error Logs"}
								</label>
								<textarea
									required
									rows={6}
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder={
										isVi
											? "Dán chi tiết lỗi, traceback, hoặc hành vi không mong muốn tại đây...\nVí dụ: Sau khi chat được 3 lượt thì server trả về 'quota exhausted', trong khi tài khoản còn credits."
											: "Paste terminal output, error message, or steps to reproduce..."
									}
									className="w-full rounded-md border border-line bg-white p-3 font-mono text-xs leading-relaxed text-ink placeholder:text-ink-2/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
								/>
							</div>
						</div>

						{/* Step 4: Screenshot Uploads (Up to 10MB per image) */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<label className="block text-xs font-mono font-semibold uppercase tracking-wider text-ink">
									4. {isVi ? "Ảnh chụp màn hình (Tối đa 8 ảnh, 10MB/ảnh)" : "Screenshots (Max 8, 10MB each)"}
								</label>
								<span className="text-[11px] font-mono text-ink-2">
									{selectedFiles.length}/8 ảnh
								</span>
							</div>

							{/* Dropzone trigger */}
							<div
								onClick={() => fileInputRef.current?.click()}
								className="group flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-line hover:border-accent bg-paper/50 hover:bg-white p-7 text-center cursor-pointer transition-all duration-200"
							>
								<div className="rounded-full bg-white group-hover:bg-accent/10 p-3 shadow-xs border border-line group-hover:border-accent/30 transition-all">
									<UploadCloud className="size-5 text-ink-2 group-hover:text-accent transition-colors" />
								</div>
								<div className="space-y-1">
									<p className="text-xs font-medium text-ink group-hover:text-accent transition-colors">
										{isVi ? "Kéo thả hoặc bấm để chọn ảnh chụp màn hình" : "Click or drag to upload error screenshots"}
									</p>
									<p className="text-[11px] text-ink-2 font-mono">
										PNG, JPG, WebP &middot; Tối đa 10MB mỗi file
									</p>
								</div>
								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									multiple
									onChange={handleFileSelect}
									className="hidden"
								/>
							</div>
							{/* File preview list */}
							{selectedFiles.length > 0 && (
								<div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
									{selectedFiles.map((f, i) => (
										<div
											key={i}
											className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper p-2 text-xs"
										>
											<div className="flex items-center gap-2 min-w-0">
												<ImageIcon className="size-4 shrink-0 text-accent" />
												<div className="min-w-0">
													<p className="font-mono text-[11px] font-medium text-ink truncate">{f.name}</p>
													<p className="text-[10px] text-ink-2">{(f.size / 1024).toFixed(1)} KB</p>
												</div>
											</div>
											<button
												type="button"
												onClick={() => removeFile(i)}
												className="p-1 text-ink-2 hover:text-[#c6293b] cursor-pointer"
											>
												<X className="size-3.5" />
											</button>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Submit button */}
						<div className="flex items-center justify-between pt-2 border-t border-line">
							<p className="text-[11.5px] text-ink-2">
								{isVi ? "Thông tin được gửi trực tiếp đến kênh quản trị viên." : "Ticket dispatched directly to admin operations."}
							</p>
							<Button
								type="submit"
								disabled={submitMutation.isPending || !title.trim() || !description.trim()}
								className="h-10 px-6 gap-2 font-mono text-xs shadow-xs"
							>
								<Send className="size-3.5" />
								<span>{submitMutation.isPending ? "Đang gửi..." : isVi ? "Gửi báo cáo sự cố" : "Submit Incident Report"}</span>
							</Button>
						</div>
					</form>
				</section>

				{/* Sidebar: Guidelines & User's tickets */}
				<aside className="space-y-6 lg:col-span-4">
					<div className="rounded-xl border border-line bg-white p-5 shadow-xs space-y-4">
						<h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink flex items-center gap-1.5">
							<ShieldCheck className="size-4 text-[#1d7a33]" />
							<span>Chính sách bảo mật hình ảnh</span>
						</h3>
						<p className="text-xs leading-relaxed text-ink-2">
							mnRouter cam kết bảo vệ dữ liệu cá nhân. Toàn bộ hình ảnh đính kèm minh chứng lỗi sẽ được{" "}
							<span className="font-bold text-ink">xoá hoàn toàn khỏi ổ đĩa server</span> ngay khi quản trị viên chuyển trạng thái sang <span className="font-mono text-[#1d7a33] font-semibold">Resolved</span>.
						</p>
						<div className="rounded-lg bg-paper p-3 text-[11.5px] font-mono text-ink-2 space-y-1.5">
							<div>• Hỗ trợ tải ảnh lên tới 10MB mỗi file</div>
							<div>• Đính kèm tối đa 8 ảnh chụp màn hình</div>
							<div>• Che bớt token hoặc thông tin nhạy cảm</div>
						</div>
					</div>

					{/* User's recent reported tickets if logged in */}
					{meData?.me && (
						<div className="rounded-xl border border-line bg-white p-5 shadow-xs space-y-4">
							<div className="flex items-center justify-between">
								<h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink flex items-center gap-1.5">
									<Clock className="size-4 text-accent" />
									<span>Sự cố bạn đã gửi ({myIssuesData?.issues?.length || 0})</span>
								</h3>
							</div>

							{(!myIssuesData?.issues || myIssuesData.issues.length === 0) ? (
								<p className="text-xs text-ink-2 italic">Bạn chưa gửi báo cáo sự cố nào.</p>
							) : (
								<div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 [scrollbar-width:thin]">
									{myIssuesData.issues.map((it) => (
										<div key={it.id} className="rounded-lg border border-line bg-paper p-3 space-y-1.5">
											<div className="flex items-center justify-between gap-2">
												<span className="font-mono text-[10.5px] text-ink-2 font-medium">
													{it.tool}
												</span>
												<Badge
													className={cn(
														"text-[10px] font-mono uppercase px-1.5 py-0.5",
														it.status === "resolved" && "bg-[#f4faf5] text-[#1d7a33] border-[#bcd9c0]",
														it.status === "investigating" && "bg-[#fef9ee] text-[#b45309] border-[#fde68a]",
														it.status === "open" && "bg-white text-ink-2 border-line"
													)}
												>
													{it.status}
												</Badge>
											</div>
											<h4 className="text-xs font-semibold text-ink line-clamp-1">{it.title}</h4>
											<p className="text-[11px] text-ink-2 line-clamp-2">{it.description}</p>
											{it.adminNote && (
												<div className="rounded bg-white p-2 text-[10.5px] border border-line text-ink">
													<span className="font-semibold text-accent">Admin phản hồi: </span>
													{it.adminNote}
												</div>
											)}
										</div>
									))}
								</div>
							)}
						</div>
					)}
				</aside>
			</div>
		</div>
	);
}
