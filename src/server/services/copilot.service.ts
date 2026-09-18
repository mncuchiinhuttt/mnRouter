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

const COPILOT_SYSTEM_PROMPT = `Bạn là Trợ lý AI Thông minh (mnRouter Copilot) hướng dẫn trực tiếp người dùng trên hệ thống mnRouter (AI Gateway nội bộ).
Nhiệm vụ của bạn:
1. Trả lời câu hỏi của người dùng bằng tiếng Việt tự nhiên, súc tích, thân thiện (xưng "tui", gọi người dùng là "ní" hoặc bạn).
2. Nếu câu hỏi có thể thực hiện trên giao diện Web, hãy sinh ra danh sách các bước chỉ dẫn (tour steps) với đúng targetSelector tương ứng để hệ thống làm mờ màn hình và khoanh vùng chỉ dẫn cho người dùng.
3. Nếu câu hỏi liên quan đến lệnh Terminal ngoài web (như cài Codex CLI, curl script, lệnh Telegram), hãy đính kèm externalSnippet chứa code để người dùng sao chép.
4. QUAN TRỌNG: Bạn PHẢI trả về ĐÚNG ĐỊNH DẠNG JSON sau (không kèm markdown format ngoài JSON):

{
  "content": "Lời giải thích ngắn gọn, rõ ràng...",
  "tour": {
    "title": "Tên hành động",
    "steps": [
      {
        "targetSelector": "[data-tour=\\"...\\"]",
        "title": "Bước 1: ...",
        "instruction": "Mô tả hành động cần làm..."
      }
    ]
  },
  "externalSnippet": {
    "title": "Tên lệnh Terminal nếu có (hoặc null)",
    "code": "lệnh chạy...",
    "hint": "Gợi ý..."
  }
}

--- BẢN ĐỒ CÁC NÚT VÀ PHẦN TỬ TRÊN GIAO DIỆN MNROUTER (DÙNG CHO targetSelector) ---
- Menu Sidebar bên trái:
  - [data-tour="nav-overview"]: Trang Tổng quan (/)
  - [data-tour="nav-usage"]: Xem chi phí và lưu lượng token (/usage)
  - [data-tour="nav-leaderboard"]: Bảng xếp hạng sử dụng (/leaderboard)
  - [data-tour="nav-keys"]: Quản lý API Keys bí mật (/keys)
  - [data-tour="nav-config"]: Cấu hình công cụ AI CLI & IDE (/config)
  - [data-tour="nav-chat"]: Không gian Chat & Agent (/chat)
  - [data-tour="nav-mcp"]: Quản lý MCP Servers & Skills (/mcp)
  - [data-tour="nav-status"]: Kiểm tra trạng thái máy chủ (/status)
  - [data-tour="nav-changelog"]: Xem nhật ký cập nhật hệ thống (/changelog)
- Menu Quản trị viên (Admin only):
  - [data-tour="nav-users"]: Quản lý tài khoản người dùng (/admin/users)
  - [data-tour="nav-connections"]: Quản lý kết nối OAuth các hãng (/admin/connections)
  - [data-tour="nav-models"]: Bật tắt và định giá Model (/admin/models)
  - [data-tour="nav-quotas"]: Giám sát hạn mức 5h và 7 ngày (/admin/quotas)
  - [data-tour="nav-analytics"]: Báo cáo thống kê chuyên sâu (/admin/analytics)
  - [data-tour="nav-logs"]: Nhật ký chi tiết từng request (/admin/logs)
  - [data-tour="nav-settings"]: Cài đặt Bot Telegram & định tuyến (/admin/settings)
- Các nút tương tác quan trọng trên trang:
  - [data-tour="create-key-btn"]: Nút "+ Create API key" trên trang /keys
  - [data-tour="key-name-input"]: Ô nhập tên khoá bí mật trong Dialog tạo key
  - [data-tour="tool-tabs"]: Danh sách chọn công cụ (Codex, Claude, OMP, Pi) trên /config
  - [data-tour="copy-script-btn"]: Nút sao chép script cài đặt 1-Click trên /config
  - [data-tour="model-selector"]: Nút chọn Model AI trong trang /chat
  - [data-tour="chat-context-pill"]: Ô Context & nút Compact trong trang /chat
  - [data-tour="invite-btn"]: Nút "+ Send invitation" trên trang /admin/users
  - [data-tour="invite-emails"]: Ô nhập nhiều email mời cùng lúc trên /admin/users
  - [data-tour="services-health"]: Bảng trạng thái dịch vụ và uptime trên /status

--- NGUYÊN TẮC:
- Bước 1 luôn là nút chuyển hướng trên menu sidebar (ví dụ [data-tour="nav-keys"] nếu người dùng cần vào trang API Keys).
- Bước 2 là nút bấm hành động cụ thể trên trang đó (ví dụ [data-tour="create-key-btn"]).
- Nếu người dùng hỏi câu hỏi lý thuyết hoặc chung chung không cần thao tác màn hình, đặt "tour": null.
- Tuyệt đối không dùng em-dash (—), dùng gạch ngang (-) hoặc chấm giữa (·).`;

export class CopilotService {
	async ask(query: string, userRole = "user"): Promise<CopilotReply> {
		// 1. Instant local intent match (< 1ms) for common platform actions
		const instant = this.tryFastMatch(query, userRole);
		if (instant) return instant;

		// 2. Query live AI model for complex or unknown questions
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
								text: `User Role: ${userRole}\nCâu hỏi: ${query}`,
							},
						],
					},
				],
				system: COPILOT_SYSTEM_PROMPT,
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
				console.warn("[copilot] AI model call failed, using fallback", err);
			}
		}

		return (
			this.tryFastMatch(query, userRole) || {
				content: "Tui có thể hỗ trợ bạn về: Tạo API Key, Cấu hình Tools (Codex/Claude), Sử dụng Chat, Xem trạng thái Server hoặc Mời thành viên. Bạn hãy thử đặt câu hỏi cụ thể nha.",
			}
		);
	}

	private tryFastMatch(query: string, userRole: string): CopilotReply | null {
		const q = query.toLowerCase().trim();

		if (q.includes("api key") || q.includes("tạo key") || q.includes("lấy key") || q.includes("key")) {
			return {
				content: "Để tạo API Key kết nối các công cụ AI bên ngoài, bạn vào trang API Keys, bấm '+ Create API key', đặt tên mô tả rồi lưu mã key lại. Bấm nút dưới đây để tui khoanh vùng chỉ từng bước nha:",
				tour: {
					title: "Tạo API Key",
					steps: [
						{ targetSelector: '[data-tour="nav-keys"]', title: "Bước 1: Mở trang API Keys", instruction: "Bấm vào mục API KEYS ở menu bên trái." },
						{ targetSelector: '[data-tour="create-key-btn"]', title: "Bước 2: Bấm Tạo khoá mới", instruction: "Bấm vào nút '+ Create API key' ở góc trên bên phải." },
						{ targetSelector: '[data-tour="key-name-input"]', title: "Bước 3: Đặt tên và Tạo khoá", instruction: "Nhập tên mô tả khoá rồi bấm Create. Sao chép mã key 'mr_...' lưu lại." },
					],
				},
			};
		}

		if (q.includes("codex") || q.includes("claude") || q.includes("omp") || q.includes("cấu hình") || q.includes("config") || q.includes("cli")) {
			return {
				content: "Trang Tools Config cung cấp script tự động nạp cấu hình models, token và router URL cho máy tính của bạn (hỗ trợ macOS/Linux và Windows). Bấm nút dưới để tui chỉ đường, hoặc chạy lệnh này ngoài Terminal:",
				tour: {
					title: "Cấu hình Tools",
					steps: [
						{ targetSelector: '[data-tour="nav-config"]', title: "Bước 1: Vào Tools Config", instruction: "Bấm vào mục TOOLS CONFIG trên menu." },
						{ targetSelector: '[data-tour="tool-tabs"]', title: "Bước 2: Chọn công cụ", instruction: "Chọn công cụ AI bạn dùng (Codex, Claude, OMP, Pi)." },
						{ targetSelector: '[data-tour="copy-script-btn"]', title: "Bước 3: Copy Script", instruction: "Bấm nút Copy script để lấy lệnh cài đặt 1-Click." },
					],
				},
				externalSnippet: {
					title: "Terminal Command (Cài Codex 1-Click)",
					code: "curl -s https://mnrouter.mncuchiinhuttt.dev/api/setup/codex | bash",
					hint: "Mở Terminal trên máy tính, dán lệnh vào và nhấn Enter.",
				},
			};
		}

		if (q.includes("chat") || q.includes("model") || q.includes("context") || q.includes("thu gọn")) {
			return {
				content: "Khu vực Chat & Agent hỗ trợ hơn 40 models đỉnh cao cùng tính năng nén ngữ cảnh working memory. Bấm nút dưới để xem các vị trí điều khiển:",
				tour: {
					title: "Khám phá Chat & Model",
					steps: [
						{ targetSelector: '[data-tour="nav-chat"]', title: "Bước 1: Vào Chat & Agent", instruction: "Bấm vào mục CHAT & AGENT trên menu." },
						{ targetSelector: '[data-tour="model-selector"]', title: "Bước 2: Chọn Model", instruction: "Bấm chọn model AI muốn trò chuyện." },
						{ targetSelector: '[data-tour="chat-context-pill"]', title: "Bước 3: Quản lý Ngữ cảnh", instruction: "Rê chuột vào ô Context để kiểm tra và nén tin nhắn cũ." },
					],
				},
			};
		}

		if (q.includes("status") || q.includes("trạng thái") || q.includes("uptime") || q.includes("server")) {
			return {
				content: "Trang Server Status giúp bạn theo dõi tình trạng hoạt động thời gian thực của các nhà cung cấp và lịch sử 30 ngày:",
				tour: {
					title: "Kiểm tra Trạng thái Server",
					steps: [
						{ targetSelector: '[data-tour="nav-status"]', title: "Bước 1: Mở Server Status", instruction: "Bấm vào mục SERVER STATUS ở nhóm SYSTEM." },
						{ targetSelector: '[data-tour="services-health"]', title: "Bước 2: Giám sát Dịch vụ", instruction: "Xem tình trạng hoạt động và tỷ lệ uptime từng model." },
					],
				},
			};
		}

		if (q.includes("mời") || q.includes("invite") || q.includes("thành viên") || q.includes("user")) {
			return {
				content: "Tính năng Mời thành viên cho phép quản trị viên gửi lời mời cho nhiều người cùng lúc với chung cấu hình hạn mức và model:",
				tour: {
					title: "Mời thành viên mới",
					steps: [
						{ targetSelector: '[data-tour="nav-users"]', title: "Bước 1: Vào Quản lý Người dùng", instruction: "Bấm vào mục USERS ở nhóm ADMIN." },
						{ targetSelector: '[data-tour="invite-btn"]', title: "Bước 2: Bấm Send invitation", instruction: "Bấm nút Send invitation ở góc trên bên phải." },
						{ targetSelector: '[data-tour="invite-emails"]', title: "Bước 3: Nhập danh sách Email", instruction: "Gõ email nhấn Enter hoặc dán danh sách nhiều email." },
					],
				},
			};
		}

		return {
			content: "Tui có thể hướng dẫn bạn về bất kỳ tính năng nào của mnRouter: Tạo API Key, Cấu hình Tools (Codex/Claude), Sử dụng Chat, Kiểm tra trạng thái máy chủ hoặc Mời thành viên. Bạn hãy thử đặt câu hỏi cụ thể nha.",
		};
	}
}

export const copilotService = new CopilotService();
