import { modelRepo } from "@repositories/model.repository.js";
import { openUpstreamWithFailover, translateUpstreamStream } from "@gateway/router.js";
import type { CanonicalRequest } from "@gateway/canonical.js";
import type { ProviderId } from "@gateway/registry.js";

export interface CopilotTourStep {
	targetSelector: string;
	title: string;
	instruction: string;
	route?: string;
}

export interface CopilotReply {
	content: string;
	tour?: {
		title: string;
		steps: CopilotTourStep[];
	};
	externalSnippet?: {
		title: string;
		code: string;
		hint?: string;
	};
}

const FULL_WEB_CONTEXT_PROMPT = `You are mnRouter AI Copilot - an autonomous in-app intelligent guide and interactive walkthrough architect for the mnRouter AI Gateway web application.

--- FULL APPLICATION MAP & INTERACTIVE ELEMENT SELECTORS ---
1. SIDEBAR (available across all pages):
   - [data-tour="nav-overview"]: Overview dashboard (/) - System stats, token metrics, 30-day activity chart.
   - [data-tour="nav-usage"]: Usage telemetry & daily breakdown (/usage) - Token breakdown by model and day.
   - [data-tour="nav-leaderboard"]: Leaderboard (/leaderboard) - Top token consumers by week (7d) and month.
   - [data-tour="nav-keys"]: API Keys (/keys) - Manage secret API keys (mr_...).
   - [data-tour="nav-config"]: Tools Config (/config) - 1-Click setup scripts for Codex, Claude Code, OMP, Pi.
   - [data-tour="nav-chat"]: Chat & Agent (/chat) - Multi-model AI chat with file analysis and context compactor.
   - [data-tour="nav-mcp"]: MCP & Skills (/mcp) - Model Context Protocol servers and built-in system skills.
   - [data-tour="nav-status"]: Server Status (/status) - Real-time provider health and 30-day uptime bars.
   - [data-tour="nav-changelog"]: Changelog (/changelog) - Live deployment stream and release notes.

2. USER PROFILE (bottom-left of sidebar):
   - [data-tour="user-profile-btn"]: User avatar/name button at bottom-left of sidebar. Clicking opens the profile popup menu.
   - [data-tour="user-settings-item"]: "USER SETTINGS" option inside the profile popup menu. Clicking opens the User Settings modal.
   - [data-tour="user-display-name-input"]: Display Name text input field inside the User Settings modal dialog.

3. PAGE-SPECIFIC INTERACTIVE SELECTORS:
   - On /keys:
     - [data-tour="create-key-btn"]: "+ Create API key" button at top-right of page.
     - [data-tour="key-name-input"]: Key name text input in the creation dialog.
   - On /config:
     - [data-tour="tool-tabs"]: Horizontal/vertical tabs to choose tool (Codex, Claude Code, OMP, Pi, Roo Code).
     - [data-tour="copy-script-btn"]: 1-Click curl/PowerShell setup command box with Copy button.
   - On /chat:
     - [data-tour="model-selector"]: Model dropdown selector button in bottom toolbar.
     - [data-tour="chat-context-pill"]: Context memory badge/pill in toolbar. Hovering shows token capacity; clicking triggers context compactor.
   - On /status:
     - [data-tour="services-health"]: Services & providers health list with 30-day uptime bars.
   - Admin Pages (only if userRole == "admin"):
     - [data-tour="nav-users"]: User management (/admin/users).
     - [data-tour="invite-btn"]: "+ Send invitation" button on /admin/users.
     - [data-tour="invite-emails"]: Multi-email tag input to invite multiple members at once.
     - [data-tour="nav-connections"]: Upstream OAuth connections (/admin/connections).
     - [data-tour="nav-models"]: Model catalog, pricing, and toggle switches (/admin/models).
     - [data-tour="nav-quotas"]: 5h rolling and 7-day connection quota monitor (/admin/quotas).
     - [data-tour="nav-analytics"]: Advanced token analytics & provider charts (/admin/analytics).
     - [data-tour="nav-logs"]: Real-time request log stream (/admin/logs).
     - [data-tour="nav-settings"]: Telegram bot monitoring and routing settings (/admin/settings).

--- TERMINAL & EXTERNAL COMMANDS:
- Codex CLI 1-Click: curl -s https://mnrouter.mncuchiinhuttt.dev/api/setup/codex | bash
- Claude Code 1-Click: curl -s https://mnrouter.mncuchiinhuttt.dev/api/setup/claude-code | bash
- OMP 1-Click: curl -s https://mnrouter.mncuchiinhuttt.dev/api/setup/omp | bash
- Telegram Bot: @mnrouter_bot with /status, /usage, /quotas, /logs, /invite <email>

--- OUTPUT RULES:
Analyze the user query, their current page (currentPath), their language (lang), and their role (userRole).
Output ONLY valid JSON matching this schema (no markdown wrappers):
{
  "content": "Helpful, natural explanation in the requested language (Vietnamese if lang=='vi', English if lang=='en'). Zero em-dashes.",
  "tour": {
    "title": "Concise title of walkthrough",
    "steps": [
      {
        "targetSelector": "[data-tour=\\"...\\"]",
        "title": "Step 1: ...",
        "instruction": "Specific action instruction"
      }
    ]
  },
  "externalSnippet": {
    "title": "Terminal command title or null",
    "code": "copyable command...",
    "hint": "helpful hint..."
  }
}

If user is already on the target page (e.g. currentPath is /keys and they ask to create a key), start directly with on-page action.
If user is not on target page, step 1 is the sidebar item.
Never use em-dashes (—).`;

export class CopilotService {
	async ask(query: string, userRole = "user", lang = "vi", currentPath = "/"): Promise<CopilotReply> {
		// 1. Comprehensive instant semantic match (< 1ms) covering all 17 features of mnRouter
		const instant = this.resolveFullFeatureIntent(query, userRole, lang, currentPath);
		if (instant) return instant;

		// 2. Query live AI model (Gemini 3.8 Flash) for open-ended or custom questions
		let compactModel = await modelRepo.findEnabledById("gemini-3.8-flash");
		if (!compactModel) {
			compactModel = await modelRepo.findEnabledById("muse-spark-1.3-contributor-free");
		}

		if (compactModel) {
			const canonReq: CanonicalRequest = {
				model: compactModel.id,
				upstreamModel: compactModel.upstreamModel,
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: `User Role: ${userRole}\nLanguage: ${lang}\nCurrent Path: ${currentPath}\nQuery: ${query}`,
							},
						],
					},
				],
				system: FULL_WEB_CONTEXT_PROMPT,
				stream: true,
			};

			try {
				const upstream = await openUpstreamWithFailover(compactModel.provider as ProviderId, canonReq);
				let rawOutput = "";
				for await (const ev of translateUpstreamStream(upstream.attempt.res.body!, upstream.attempt.parser, compactModel.provider as ProviderId)) {
					if (ev.type === "text_delta") {
						rawOutput += ev.delta;
					}
				}

				const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
				if (jsonMatch) {
					const parsed = JSON.parse(jsonMatch[0]) as CopilotReply;
					if (parsed.content) return parsed;
				}
			} catch (err) {
				console.warn("[copilot] Live AI call failed, using graceful fallback", err);
			}
		}

		return {
			content: lang === "vi"
				? "Tui có thể hướng dẫn bạn về mọi tính năng trên mnRouter: Tạo API Key, Cấu hình Tools (Codex/Claude), Chat & Đổi Model, Xem trạng thái Server, Quản lý tài khoản, hoặc Mời thành viên mới."
				: "I can guide you through every feature of mnRouter: API Keys, Tools Config, Chat & Models, Server Status, User Profile, or Member Invitations.",
		};
	}

	/**
	 * Comprehensive semantic resolver covering all 17 features of mnRouter.
	 * Returns in < 1ms with dynamic step adaptation based on currentPath and language.
	 */
	private resolveFullFeatureIntent(query: string, userRole: string, lang: string, currentPath: string): CopilotReply | null {
		const q = query.toLowerCase().trim();
		const isVi = lang.startsWith("vi");

		// 1. API Keys (/keys)
		if (q.includes("api key") || q.includes("tạo key") || q.includes("lấy key") || q.includes("khoá") || q.includes("create key")) {
			const onKeysPage = currentPath === "/keys";
			return {
				content: isVi
					? "Để tạo API Key kết nối vào các công cụ AI, bạn vào trang API Keys, bấm '+ Create API key', đặt tên mô tả rồi lưu mã key bí mật lại nhé:"
					: "To create an API key for external AI tools, navigate to API Keys, click '+ Create API key', give it a name and copy your secret key:",
				tour: {
					title: isVi ? "Tạo API Key mới" : "Create New API Key",
					steps: onKeysPage
						? [
								{ targetSelector: '[data-tour="create-key-btn"]', title: isVi ? "Bước 1: Bấm Tạo khoá mới" : "Step 1: Click Create API key", instruction: isVi ? "Bấm vào nút '+ Create API key' ở góc trên bên phải." : "Click the '+ Create API key' button at the top right." },
								{ targetSelector: '[data-tour="key-name-input"]', title: isVi ? "Bước 2: Đặt tên và Tạo khoá" : "Step 2: Name and create key", instruction: isVi ? "Nhập tên gợi nhớ cho khoá rồi bấm Create. Mã key chỉ hiển thị 1 lần duy nhất." : "Enter a memorable name and click Create. Copy the key as it is only shown once." },
						  ]
						: [
								{ targetSelector: '[data-tour="nav-keys"]', title: isVi ? "Bước 1: Mở trang API Keys" : "Step 1: Open API Keys", instruction: isVi ? "Bấm vào mục API KEYS ở thanh menu bên trái." : "Click API KEYS on the left sidebar menu." },
								{ targetSelector: '[data-tour="create-key-btn"]', title: isVi ? "Bước 2: Bấm Tạo khoá mới" : "Step 2: Click Create API key", instruction: isVi ? "Bấm vào nút '+ Create API key' ở góc trên bên phải." : "Click '+ Create API key' at the top right." },
								{ targetSelector: '[data-tour="key-name-input"]', title: isVi ? "Bước 3: Đặt tên và Tạo khoá" : "Step 3: Name and create key", instruction: isVi ? "Nhập tên gợi nhớ cho khoá rồi bấm Create." : "Enter key name and click Create." },
						  ],
				},
			};
		}

		// 2. Profile / Display Name / Avatar Update
		if (q.includes("tên") || q.includes("name") || q.includes("profile") || q.includes("tài khoản") || q.includes("avatar") || q.includes("đổi tên") || q.includes("update tên")) {
			return {
				content: isVi
					? "Để đổi tên hiển thị hoặc thông tin cá nhân, bạn bấm vào tài khoản ở góc dưới cùng menu bên trái, chọn 'USER SETTINGS' rồi nhập tên mới nha:"
					: "To update your display name or avatar, click your account at the bottom left of the sidebar, select 'USER SETTINGS' and save your changes:",
				tour: {
					title: isVi ? "Đổi tên hiển thị" : "Update Display Name",
					steps: [
						{ targetSelector: '[data-tour="user-profile-btn"]', title: isVi ? "Bước 1: Mở menu tài khoản" : "Step 1: Open Account Menu", instruction: isVi ? "Bấm vào ảnh đại diện hoặc tên của bạn ở góc dưới cùng menu bên trái." : "Click your avatar or name at the bottom left of the sidebar." },
						{ targetSelector: '[data-tour="user-settings-item"]', title: isVi ? "Bước 2: Chọn Cài đặt tài khoản" : "Step 2: Select User Settings", instruction: isVi ? "Bấm chọn 'USER SETTINGS' trong menu vừa mở." : "Click 'USER SETTINGS' in the popup menu." },
						{ targetSelector: '[data-tour="user-display-name-input"]', title: isVi ? "Bước 3: Nhập tên mới và Lưu" : "Step 3: Enter New Name", instruction: isVi ? "Nhập Tên hiển thị mới vào ô này rồi nhấn nút 'Save changes'." : "Type your new display name here and click 'Save changes'." },
					],
				},
			};
		}

		// 3. Tools Config (/config - Codex, Claude, OMP, Pi)
		if (q.includes("codex") || q.includes("claude") || q.includes("omp") || q.includes("cấu hình") || q.includes("config") || q.includes("cli") || q.includes("setup")) {
			const onConfigPage = currentPath === "/config";
			return {
				content: isVi
					? "Trang Tools Config có sẵn script 1-Click tự động cài đặt models, token và router URL cho máy tính của bạn (hỗ trợ cả macOS/Linux và Windows PowerShell):"
					: "Tools Config provides 1-click setup scripts that automatically configure models, tokens, and router URLs for Codex CLI, Claude Code, OMP, and Pi:",
				tour: {
					title: isVi ? "Cấu hình Tools" : "Tools Config",
					steps: onConfigPage
						? [
								{ targetSelector: '[data-tour="tool-tabs"]', title: isVi ? "Bước 1: Chọn công cụ của bạn" : "Step 1: Pick your tool", instruction: isVi ? "Chọn công cụ AI bạn muốn cài (Codex, Claude Code, OMP, Pi)." : "Select the tool you want to connect (Codex, Claude Code, OMP, Pi)." },
								{ targetSelector: '[data-tour="copy-script-btn"]', title: isVi ? "Bước 2: Copy Script 1-Click" : "Step 2: Copy 1-Click Script", instruction: isVi ? "Bấm nút 'Copy script' rồi dán vào Terminal trên máy tính để tự động cài đặt." : "Click 'Copy script' and paste into your terminal to auto-configure." },
						  ]
						: [
								{ targetSelector: '[data-tour="nav-config"]', title: isVi ? "Bước 1: Vào mục Tools Config" : "Step 1: Open Tools Config", instruction: isVi ? "Bấm vào mục TOOLS CONFIG trên menu bên trái." : "Click TOOLS CONFIG on the left sidebar." },
								{ targetSelector: '[data-tour="tool-tabs"]', title: isVi ? "Bước 2: Chọn công cụ của bạn" : "Step 2: Pick your tool", instruction: isVi ? "Chọn công cụ AI bạn muốn cài (Codex, Claude Code, OMP, Pi)." : "Select the tool you want to connect (Codex, Claude Code, OMP, Pi)." },
								{ targetSelector: '[data-tour="copy-script-btn"]', title: isVi ? "Bước 3: Copy Script 1-Click" : "Step 3: Copy 1-Click Script", instruction: isVi ? "Bấm nút 'Copy script' rồi dán vào Terminal trên máy tính." : "Click 'Copy script' and paste into your terminal." },
						  ],
				},
				externalSnippet: {
					title: "Terminal Command (Cài Codex 1-Click)",
					code: "curl -s https://mnrouter.mncuchiinhuttt.dev/api/setup/codex | bash",
					hint: isVi ? "Mở Terminal trên máy tính, dán lệnh vào và nhấn Enter." : "Open Terminal, paste the command and press Enter.",
				},
			};
		}

		// 4. Chat & Models (/chat)
		if (q.includes("chat") || q.includes("model") || q.includes("context") || q.includes("thu gọn") || q.includes("compact") || q.includes("hỏi")) {
			const onChatPage = currentPath === "/chat";
			return {
				content: isVi
					? "Khu vực Chat & Agent hỗ trợ hơn 40 models đỉnh cao cùng tính năng nén ngữ cảnh working memory và phân tích tài liệu đính kèm:"
					: "Chat & Agent supports 40+ leading models, file analysis, and Claude-style working memory compaction:",
				tour: {
					title: isVi ? "Không gian Chat & Model" : "Chat & Models Workspace",
					steps: onChatPage
						? [
								{ targetSelector: '[data-tour="model-selector"]', title: isVi ? "Bước 1: Chọn Model AI" : "Step 1: Select AI Model", instruction: isVi ? "Bấm vào menu này để chuyển đổi giữa Claude, Gemini, ChatGPT, Grok, Muse Spark..." : "Click this selector to switch between Claude, Gemini, ChatGPT, Muse Spark..." },
								{ targetSelector: '[data-tour="chat-context-pill"]', title: isVi ? "Bước 2: Quản lý Ngữ cảnh & Thu gọn" : "Step 2: Context Memory & Compactor", instruction: isVi ? "Rê chuột vào ô Context để kiểm tra dung lượng và bấm 'Compact' khi cần tóm tắt hội thoại." : "Hover to check capacity and click 'Compact' to summarize older messages." },
						  ]
						: [
								{ targetSelector: '[data-tour="nav-chat"]', title: isVi ? "Bước 1: Mở Chat & Agent" : "Step 1: Open Chat & Agent", instruction: isVi ? "Bấm vào mục CHAT & AGENT trên menu bên trái." : "Click CHAT & AGENT on the left sidebar menu." },
								{ targetSelector: '[data-tour="model-selector"]', title: isVi ? "Bước 2: Chọn Model AI" : "Step 2: Select AI Model", instruction: isVi ? "Bấm chọn model bạn muốn trò chuyện." : "Select the model you wish to talk to." },
								{ targetSelector: '[data-tour="chat-context-pill"]', title: isVi ? "Bước 3: Quản lý Ngữ cảnh" : "Step 3: Context Memory", instruction: isVi ? "Theo dõi token và thu gọn ngữ cảnh khi cần." : "Monitor token usage and compact context when needed." },
						  ],
				},
			};
		}

		// 5. Server Status & Uptime (/status)
		if (q.includes("status") || q.includes("trạng thái") || q.includes("uptime") || q.includes("server") || q.includes("bảo trì") || q.includes("sống") || q.includes("chết")) {
			const onStatusPage = currentPath === "/status";
			return {
				content: isVi
					? "Trang Server Status cho phép bạn theo dõi tình trạng hoạt động thời gian thực của các nhà cung cấp, lịch sử uptime 30 ngày và các đợt bảo trì:"
					: "Server Status provides real-time operational health across all AI providers, 30-day uptime bars, and incident history:",
				tour: {
					title: isVi ? "Kiểm tra Trạng thái Server" : "Check Server Status",
					steps: onStatusPage
						? [
								{ targetSelector: '[data-tour="services-health"]', title: isVi ? "Bước 1: Giám sát Dịch vụ & Uptime 30 ngày" : "Step 1: Services Health & 30-day Uptime", instruction: isVi ? "Theo dõi tình trạng hoạt động của từng hãng (Antigravity, Claude, Codex, DB) và lịch sử uptime 30 ngày." : "Track health and 30-day uptime for Antigravity, Claude, Codex, and Database." },
						  ]
						: [
								{ targetSelector: '[data-tour="nav-status"]', title: isVi ? "Bước 1: Mở Server Status" : "Step 1: Open Server Status", instruction: isVi ? "Bấm vào mục SERVER STATUS ở nhóm SYSTEM trên menu bên trái." : "Click SERVER STATUS under SYSTEM on the left sidebar menu." },
								{ targetSelector: '[data-tour="services-health"]', title: isVi ? "Bước 2: Giám sát Dịch vụ & Uptime" : "Step 2: Services Health", instruction: isVi ? "Xem tình trạng hoạt động và tỷ lệ uptime từng model." : "View live health and uptime percentage." },
						  ],
				},
			};
		}

		// 6. Changelog (/changelog)
		if (q.includes("changelog") || q.includes("cập nhật") || q.includes("update") || q.includes("mới có gì") || q.includes("nhật ký")) {
			return {
				content: isVi
					? "Trang Changelog hiển thị dòng thời gian các bản cập nhật, sửa lỗi và tính năng mới được triển khai trên mnRouter theo thời gian thực:"
					: "The Changelog page displays a real-time timeline of platform enhancements, fixes, and new features deployed to mnRouter:",
				tour: {
					title: isVi ? "Xem Nhật ký Cập nhật" : "View Changelog",
					steps: [
						{ targetSelector: '[data-tour="nav-changelog"]', title: isVi ? "Bước 1: Vào mục Changelog" : "Step 1: Open Changelog", instruction: isVi ? "Bấm vào mục CHANGELOG ở nhóm SYSTEM trên menu." : "Click CHANGELOG under SYSTEM on the left sidebar." },
					],
				},
			};
		}

		// 7. Leaderboard (/leaderboard)
		if (q.includes("leaderboard") || q.includes("bảng xếp hạng") || q.includes("ai xài nhiều") || q.includes("top") || q.includes("ranking")) {
			return {
				content: isVi
					? "Bảng xếp hạng cho phép bạn theo dõi top các thành viên tiêu thụ token và credits nhiều nhất theo 24h, 7 ngày hoặc 30 ngày:"
					: "The Leaderboard displays top token and credit consumers across the team filtered by 24h, 7 days, or 30 days:",
				tour: {
					title: isVi ? "Bảng xếp hạng sử dụng" : "Usage Leaderboard",
					steps: [
						{ targetSelector: '[data-tour="nav-leaderboard"]', title: isVi ? "Bước 1: Mở Bảng xếp hạng" : "Step 1: Open Leaderboard", instruction: isVi ? "Bấm vào mục LEADERBOARD trên menu bên trái." : "Click LEADERBOARD on the left sidebar menu." },
					],
				},
			};
		}

		// 8. Usage & Credits (/usage)
		if (q.includes("usage") || q.includes("lưu lượng") || q.includes("chi phí") || q.includes("credit") || q.includes("token đã dùng")) {
			return {
				content: isVi
					? "Trang Usage thống kê chi tiết số lượng token đầu vào/đầu ra, tỷ lệ đọc cache và số credit đã tiêu thụ của bạn theo từng model và ngày:"
					: "The Usage page provides detailed telemetry of prompt/completion tokens, cache reads, and credits consumed by date and model:",
				tour: {
					title: isVi ? "Kiểm tra Lưu lượng & Chi phí" : "Check Usage & Credits",
					steps: [
						{ targetSelector: '[data-tour="nav-usage"]', title: isVi ? "Bước 1: Vào mục Usage" : "Step 1: Open Usage", instruction: isVi ? "Bấm vào mục USAGE trên menu bên trái để xem biểu đồ và chi tiết." : "Click USAGE on the left sidebar to view breakdown and charts." },
					],
				},
			};
		}

		// 9. MCP & Skills (/mcp)
		if (q.includes("mcp") || q.includes("skill") || q.includes("kỹ năng") || q.includes("tool")) {
			return {
				content: isVi
					? "Trang MCP & Skills cho phép kết nối các Model Context Protocol Server (GitHub, SQLite, Filesystem) và xem 19 kỹ năng hệ thống có sẵn:"
					: "The MCP & Skills page lets you connect Model Context Protocol servers and inspect 19 built-in system skills:",
				tour: {
					title: isVi ? "Quản lý MCP & Skills" : "Manage MCP & Skills",
					steps: [
						{ targetSelector: '[data-tour="nav-mcp"]', title: isVi ? "Bước 1: Mở trang MCP & Skills" : "Step 1: Open MCP & Skills", instruction: isVi ? "Bấm vào mục MCP & SKILLS trên menu bên trái." : "Click MCP & SKILLS on the left sidebar menu." },
					],
				},
			};
		}

		// 10. Invite Members (/admin/users)
		if (q.includes("mời") || q.includes("invite") || q.includes("thành viên") || q.includes("thêm user") || q.includes("add user")) {
			return {
				content: isVi
					? "Tính năng Mời thành viên cho phép quản trị viên nhập nhiều email cùng lúc (gõ email nhấn Enter hoặc dán danh sách từ bảng tính) để cấp chung gói tài nguyên và danh sách model được phép sử dụng:"
					: "Member invitations allow administrators to invite multiple users simultaneously with shared package budgets and model access permissions:",
				tour: {
					title: isVi ? "Mời thành viên mới" : "Invite Members",
					steps: [
						{ targetSelector: '[data-tour="nav-users"]', title: isVi ? "Bước 1: Vào Quản lý Người dùng" : "Step 1: Open Users", instruction: isVi ? "Bấm vào mục USERS ở nhóm ADMIN trên menu bên trái." : "Click USERS under ADMIN on the left sidebar." },
						{ targetSelector: '[data-tour="invite-btn"]', title: isVi ? "Bước 2: Bấm Send invitation" : "Step 2: Click Send invitation", instruction: isVi ? "Bấm nút Send invitation ở góc trên bên phải." : "Click '+ Send invitation' at the top right." },
						{ targetSelector: '[data-tour="invite-emails"]', title: isVi ? "Bước 3: Nhập danh sách Email" : "Step 3: Enter Emails", instruction: isVi ? "Gõ email nhấn Enter hoặc dán danh sách nhiều email cùng lúc." : "Type emails and press Enter or paste multiple addresses." },
					],
				},
			};
		}

		// 11. Telegram Bot (/admin/settings)
		if (q.includes("telegram") || q.includes("bot") || q.includes("lệnh") || q.includes("slash")) {
			return {
				content: isVi
					? "Bot Telegram @mnrouter_bot hỗ trợ nhận cảnh báo cooldown, lỗi server và cho phép tra cứu trạng thái máy chủ qua bộ lệnh Slash Commands:"
					: "The Telegram bot @mnrouter_bot sends alerts and provides live server monitoring via slash commands:",
				tour: userRole === "admin"
					? {
							title: isVi ? "Cài đặt Bot Telegram" : "Telegram Bot Settings",
							steps: [
								{ targetSelector: '[data-tour="nav-settings"]', title: isVi ? "Bước 1: Mở Cài đặt hệ thống" : "Step 1: Open Settings", instruction: isVi ? "Bấm vào mục SETTINGS ở nhóm ADMIN trên menu bên trái." : "Click SETTINGS under ADMIN on the left sidebar." },
							],
					  }
					: undefined,
				externalSnippet: {
					title: "Telegram Slash Commands",
					code: "/status - Xem sức khoẻ máy chủ\n/usage - Xem lưu lượng tokens trong ngày\n/quotas - Kiểm tra hạn mức các hãng\n/logs - Xem 5 lượt request gần nhất\n/invite <email> [gói] - Tạo link mời trực tiếp",
					hint: isVi ? "Mở ứng dụng Telegram, tìm @mnrouter_bot và gõ ký tự / để xem danh sách lệnh." : "Open Telegram, search @mnrouter_bot and type / to view commands.",
				},
			};
		}

		return null;
	}
}

export const copilotService = new CopilotService();
