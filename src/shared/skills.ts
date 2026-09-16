export interface HarnessSkill {
	id: string;
	name: string;
	shortName: string;
	icon: "Cpu" | "Bug" | "ShieldCheck" | "Maximize2" | "Sparkles" | "Layers" | "Search" | "Rocket" | "GraduationCap" | "BookOpen" | "Presentation" | "FileText";
	description: string;
	prompt: string;
}

export type ThinkingLevel = "off" | "low" | "medium" | "high" | "xhigh" | "max";

export interface ThinkingOption {
	id: ThinkingLevel;
	label: string;
	budgetTokens: number;
	desc: string;
}

export const THINKING_LEVELS: ThinkingOption[] = [
	{ id: "off", label: "Thinking: Off", budgetTokens: 0, desc: "Fastest response, no thinking budget" },
	{ id: "low", label: "Thinking: Low", budgetTokens: 1024, desc: "Quick reasoning tokens for simple code" },
	{ id: "medium", label: "Thinking: Medium", budgetTokens: 4096, desc: "Balanced reasoning for multi-step logic" },
	{ id: "high", label: "Thinking: High", budgetTokens: 8192, desc: "Deep reasoning for complex architectures" },
	{ id: "xhigh", label: "Thinking: Extra High", budgetTokens: 16384, desc: "Intensive reasoning for full system design" },
	{ id: "max", label: "Thinking: Max", budgetTokens: 32768, desc: "Exhaustive reasoning for hardest problem solving" },
];

export function getModelThinkingLevels(modelId: string, provider?: string): ThinkingLevel[] {
	const m = (modelId || "").toLowerCase();
	const p = (provider || "").toLowerCase();
	if (p === "antigravity" || m.includes("gemini")) {
		return ["off", "low", "medium", "high"];
	}
	if (m.includes("muse-spark")) {
		return ["off", "low", "medium", "high", "xhigh"];
	}
	return ["off", "low", "medium", "high", "xhigh", "max"];
}
export const HARNESS_SKILLS: HarnessSkill[] = [
	{
		id: "full-output",
		name: "Full Output Enforcement",
		shortName: "Full Output",
		icon: "Maximize2",
		description: "Enforces complete code generation without placeholders, ellipsis, or 'TODO' stubs.",
		prompt: "IMPORTANT: NEVER use placeholders, abbreviations, or ellipsis comments like '// rest of code here', 'TODO: implement', or '...'. Always provide exhaustive, unabridged, complete runnable code files from start to finish.",
	},
	{
		id: "system-design",
		name: "System Design Architect",
		shortName: "Architecture",
		icon: "Cpu",
		description: "High-level distributed systems, microservices, scaling patterns, database sharding, and resilience.",
		prompt: "Adopt the persona of a Principal Systems Architect. Evaluate trade-offs (CAP theorem, backpressure, rate limiting, caching strategies, event-driven architecture, and database partitioning). Provide concrete data structures, schemas, and architectural diagrams.",
	},
	{
		id: "debug-expert",
		name: "Deep Debug & Root Cause",
		shortName: "Debugger",
		icon: "Bug",
		description: "Systematic root cause analysis, stack tracing, reproduction scripts, and defensive verification.",
		prompt: "Apply systematic root cause analysis before proposing any fix. Formulate hypotheses, isolate failure boundaries, trace call stacks, verify reproducing test cases, and explain why the bug occurred before patching.",
	},
	{
		id: "security-audit",
		name: "Security & OWASP Audit",
		shortName: "Security",
		icon: "ShieldCheck",
		description: "Vulnerability discovery, injection prevention, auth hardening, secret leakage checks, and defensive coding.",
		prompt: "Apply strict defensive application security standards. Review code against OWASP Top 10, check for injection flaws, authentication bypasses, IDOR, SSRF, CORS misconfigurations, and ensure zero confidential credentials leak.",
	},
	{
		id: "frontend-taste",
		name: "Frontend Design Taste",
		shortName: "Design Taste",
		icon: "Sparkles",
		description: "Anti-AI-slop frontend engineering, luxury typography, fluid motion physics, and accessible neo-modernism.",
		prompt: "Apply high-craft anti-slop frontend design taste. Ban generic purple gradients, cards-inside-cards, and floating div placeholders. Enforce crisp typography (Space Grotesk + IBM Plex Mono), purposeful motion, responsive full-bleed layouts, and strict WCAG AA contrast.",
	},
	{
		id: "clean-architecture",
		name: "Clean Architecture & DDD",
		shortName: "Clean Code",
		icon: "Layers",
		description: "Hexagonal / Ports & Adapters, SOLID principles, 200-line modularity, and domain-driven design.",
		prompt: "Enforce Clean Architecture and Domain-Driven Design (DDD). Strictly separate Router/Controller -> Service -> Repository -> Database. Keep individual code files under 200 lines, adhering to YAGNI, KISS, and DRY principles.",
	},
	{
		id: "deep-research",
		name: "Deep Research & Evidence",
		shortName: "Research",
		icon: "Search",
		description: "Multi-perspective synthesis, citation grounding, trade-off comparisons, and structured evaluation.",
		prompt: "Conduct rigorous research synthesis. Corroborate claims with primary technical evidence, compare alternative technologies, articulate non-obvious trade-offs, and structure findings into clear decision frameworks.",
	},
	{
		id: "performance-optimization",
		name: "Performance & Zero-Alloc",
		shortName: "Performance",
		icon: "Rocket",
		description: "CPU/memory profiling, zero-allocation tuning, query indexing, and latency minimization.",
		prompt: "Focus on maximum runtime efficiency and low latency. Eliminate avoidable allocations, avoid unnecessary object copying, optimize database indexes and streaming pipelines, and target sub-millisecond execution.",
	},
	{
		id: "academic-paper",
		name: "Academic Paper Writing",
		shortName: "Academic Paper",
		icon: "GraduationCap",
		description: "Cấu trúc bài báo khoa học chuẩn APA/IEEE, tổng quan tài liệu (literature review), lập luận bằng chứng và văn phong học thuật.",
		prompt: "Tuân thủ nghiêm ngặt văn phong học thuật (Academic Standards). Sử dụng cấu trúc bài báo chuẩn (Abstract, Introduction, Literature Review, Methodology, Results, Discussion, Conclusion). Trích dẫn rõ ràng theo chuẩn APA 7th hoặc IEEE, lập luận chặt chẽ dựa trên dữ liệu bằng chứng (evidence-first), tránh sáo rỗng.",
	},
	{
		id: "academic-reviewer",
		name: "Peer Reviewer & Critique",
		shortName: "Peer Reviewer",
		icon: "BookOpen",
		description: "Đóng vai trò chuyên gia phản biện học thuật độc lập, mổ xẻ phương pháp luận, phát hiện lỗ hổng và rủi ro sai lệch dữ liệu.",
		prompt: "Đóng vai trò Hội đồng phản biện học thuật độc lập (Academic Peer Reviewer Panel). Đánh giá khắt khe tính mới (novelty), phương pháp nghiên cứu (methodology), rủi ro sai lệch (bias), tính tái lập (reproducibility) và đưa ra các câu hỏi phản biện sâu sắc mang tính xây dựng.",
	},
	{
		id: "pptx-creator",
		name: "PPTX Presentation Architect",
		shortName: "Slide / PPTX",
		icon: "Presentation",
		description: "Thiết kế cấu trúc bài thuyết trình, slide deck chuyên nghiệp, tạo mã python-pptx và Marp/HTML slide để xuất file PPTX trực tiếp.",
		prompt: "Bạn là chuyên gia thiết kế bài thuyết trình (Presentation Architect & Slide Deck Designer). Khi người dùng yêu cầu tạo slide, bài thuyết trình hoặc nội dung PPTX:\n1. Phân tích đối tượng người nghe, mục tiêu bài nói và cấu trúc slide logic (Title slide, Hook/Problem, Solution, Value Proposition, Deep-dive data/case study, Summary & Call-to-action).\n2. Cung cấp nội dung từng slide rõ ràng gồm: Tiêu đề slide, bullet points chắt lọc (tránh chữ dày đặc), gợi ý bố cục trực quan (Layout direction), và Presenter Notes cho diễn giả.\n3. Luôn đính kèm mã nguồn Python hoàn chỉnh sử dụng thư viện `python-pptx` (hoặc cấu trúc Marp / Slidev Markdown) với màu sắc hiện đại, typography phân cấp, bảng biểu hoặc biểu đồ để người dùng có thể chạy và xuất ngay ra file .pptx thực tế.",
	},
	{
		id: "pdf-document-analyst",
		name: "PDF & Document Deep Analysis",
		shortName: "PDF / Doc",
		icon: "FileText",
		description: "Phân tích, tóm tắt, giải toàn bộ bài tập và trích xuất dữ liệu có cấu trúc từ tài liệu PDF, DOCX, XLSX đính kèm.",
		prompt: "Bạn là chuyên gia phân tích tài liệu và giải đề chuyên sâu (Document & PDF Deep Analyst). Khi người dùng tải lên tài liệu (PDF, Word, Excel, văn bản) hoặc yêu cầu giải đề thi/bài tập, tóm tắt, trích xuất dữ liệu:\n1. Đọc và bám sát toàn bộ nội dung văn bản tài liệu đính kèm được cung cấp trong ngữ cảnh.\n2. Trả lời trực tiếp, đầy đủ, chi tiết từng câu hỏi, bài tập hoặc yêu cầu (tuyệt đối không bỏ sót bất kỳ câu hỏi nào trong đề).\n3. Nếu là đề bài tập/kỹ thuật (như lập trình C++/Java/Python, thuật toán, OOP, thiết kế hệ thống), giải chi tiết từng bước, cung cấp mã nguồn hoàn chỉnh có chú thích rõ ràng, giải thích cặn kẽ và ghi rõ thang điểm tương ứng của từng câu hỏi.",
	},
	{
		id: "pdf-creator",
		name: "PDF Document Architect & Generator",
		shortName: "PDF Creator",
		icon: "FileText",
		description: "Thiết kế và xuất tài liệu PDF chuẩn in ấn A4 (báo cáo, hóa đơn, CV, hợp đồng) qua HTML/CSS Print hoặc Python ReportLab/WeasyPrint.",
		prompt: "Bạn là chuyên gia thiết kế và xuất bản tài liệu PDF chuyên nghiệp (PDF Document Architect & Generator). Khi người dùng yêu cầu tạo tài liệu PDF (báo cáo, CV, đề cương, hóa đơn, chứng chỉ, hợp đồng):\n1. Ưu tiên tạo Artifact HTML/CSS chuẩn in ấn A4 với CSS Paged Media: kích thước @page { size: A4; margin: 15mm 20mm; }, ngắt trang hợp lý (page-break-inside: avoid; break-after: page;), typography thanh lịch, phân cấp tiêu đề, header/footer cố định và số trang, bảng biểu có shading tinh tế để người dùng có thể xem trước trực tiếp trên giao diện và bấm nút 'In / PDF' xuất ra file PDF hoàn hảo.\n2. Nếu người dùng yêu cầu mã nguồn tạo file PDF tự động: cung cấp mã Python hoàn chỉnh, sẵn sàng chạy bằng `reportlab` (Platypus Flowables, ParagraphStyle, TableStyle) hoặc `weasyprint`, đảm bảo xử lý font Unicode tiếng Việt, lề trang chuẩn xác và bảng dữ liệu được căn chỉnh chuyên nghiệp.",
	},
	{
		id: "docx-creator",
		name: "Word Document Architect & Generator",
		shortName: "Word / DOCX",
		icon: "FileText",
		description: "Soạn thảo và tạo file Microsoft Word (.docx) chuẩn văn phòng doanh nghiệp (bìa báo cáo, Heading 1-4, bảng biểu, headers/footers) bằng python-docx.",
		prompt: "Bạn là chuyên gia thiết kế tài liệu Microsoft Word chuyên nghiệp (Word / DOCX Document Architect). Khi người dùng yêu cầu soạn thảo văn bản, hợp đồng, báo cáo kinh doanh hoặc tạo file Word (.docx):\n1. Lên cấu trúc văn bản phân cấp chuẩn: Trang bìa chuyên nghiệp (Title, Subtitle, Metadata tác giả/ngày tháng, ngắt trang), Mục lục tự động, các cấp tiêu đề Heading 1 đến Heading 4 theo typography doanh nghiệp.\n2. Thiết kế bảng biểu (Tables) có style tinh tế: Header có màu nền (shading), độ rộng cột cân đối, viền kẻ mảnh thanh lịch, căn lề số liệu bên phải, căn lề chữ bên trái.\n3. Các hộp ghi chú (Callout boxes) có viền trái màu accent, định dạng header/footer, đánh số trang ở góc phải chân trang (Page X of Y).\n4. Luôn cung cấp mã nguồn Python hoàn chỉnh sử dụng thư viện `python-docx` với đầy đủ các hàm định dạng màu sắc, font chữ (Arial / Calibri / Times New Roman), lề trang (1 inch / 25.4mm) để người dùng có thể chạy mã và nhận ngay file .docx chuẩn mực.",
	},
];
