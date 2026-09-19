export interface HarnessConfig {
	id: string;
	name: string;
	icon: string;
	badge: string;
	protocol: string;
	descEn: string;
	descVi: string;
	quickRun: (base: string, key: string) => string;
	persistZsh: (base: string, key: string) => string;
	configFile?: { path: string; lang: "json" | "toml" | "yaml" | "bash"; content: (base: string, key: string) => string };
	verify: (base: string, key: string) => string;
}

export const HARNESSES: HarnessConfig[] = [
	{
		id: "claude-code",
		name: "Claude Code",
		icon: "/harnesses/claude.png",
		badge: "Anthropic /v1/messages",
		protocol: "Native Anthropic Messages",
		descEn: "Official Claude Code CLI. Routes through mnRouter Anthropic Messages ingress.",
		descVi: "CLI chính thức của Claude Code. Định tuyến qua endpoint /v1/messages của mnRouter.",
		quickRun: (base, key) => `export ANTHROPIC_BASE_URL="${base}"\nexport ANTHROPIC_API_KEY="${key}"\nclaude --model claude-sonnet-5`,
		persistZsh: (base, key) => `echo 'export ANTHROPIC_BASE_URL="${base}"' >> ~/.zshrc\necho 'export ANTHROPIC_API_KEY="${key}"' >> ~/.zshrc\nsource ~/.zshrc`,
		configFile: { path: "~/.claude/config.json", lang: "json", content: () => `{\n  "defaultModel": "claude-sonnet-5",\n  "alwaysApproveResets": true\n}` },
		verify: (base, key) => `curl -fsSL "${base}/v1/messages" \\\n  -H "x-api-key: ${key}" \\\n  -H "anthropic-version: 2023-06-01" \\\n  -H "content-type: application/json" \\\n  -d '{"model":"claude-sonnet-5","max_tokens":30,"messages":[{"role":"user","content":"Hi"}]}'`,
	},
	{
		id: "claude-cowork",
		name: "Claude Cowork",
		icon: "/harnesses/claude.png",
		badge: "Anthropic Native",
		protocol: "Desktop / Cowork Agent",
		descEn: "Claude Desktop and Cowork agent integrations. Set custom endpoint in environment.",
		descVi: "Ứng dụng Claude Desktop và agent Cowork. Cấu hình endpoint qua biến môi trường.",
		quickRun: (base, key) => `export ANTHROPIC_BASE_URL="${base}"\nexport ANTHROPIC_API_KEY="${key}"\nexport CLAUDE_BASE_URL="${base}"`,
		persistZsh: (base, key) => `echo 'export ANTHROPIC_BASE_URL="${base}"' >> ~/.zshrc\necho 'export ANTHROPIC_API_KEY="${key}"' >> ~/.zshrc\nsource ~/.zshrc`,
		configFile: {
			path: "~/Library/Application Support/Claude/claude_desktop_config.json",
			lang: "json",
			content: (base, key) => `{\n  "globalShortcut": "Space",\n  "env": {\n    "ANTHROPIC_BASE_URL": "${base}",\n    "ANTHROPIC_API_KEY": "${key}"\n  }\n}`,
		},
		verify: (base, key) => `curl -fsSL "${base}/v1/models" -H "authorization: Bearer ${key}"`,
	},
	{
		id: "openclaw",
		name: "OpenClaw",
		icon: "/harnesses/openclaw.png",
		badge: "OpenAI /v1/chat",
		protocol: "OpenAI-compatible Chat",
		descEn: "OpenClaw autonomous agent. Connects via OpenAI chat completions interface.",
		descVi: "Agent tự động OpenClaw. Kết nối qua cổng chat completions chuẩn OpenAI.",
		quickRun: (base, key) => `export OPENCLAW_API_BASE="${base}/v1"\nexport OPENCLAW_API_KEY="${key}"\nopenclaw --model claude-sonnet-5`,
		persistZsh: (base, key) => `echo 'export OPENCLAW_API_BASE="${base}/v1"' >> ~/.zshrc\necho 'export OPENCLAW_API_KEY="${key}"' >> ~/.zshrc\nsource ~/.zshrc`,
		configFile: { path: "~/.openclaw/config.json", lang: "json", content: (base, key) => `{\n  "baseUrl": "${base}/v1",\n  "apiKey": "${key}",\n  "defaultModel": "claude-sonnet-5"\n}` },
		verify: (base, key) => `curl -fsSL "${base}/v1/chat/completions" \\\n  -H "authorization: Bearer ${key}" \\\n  -H "content-type: application/json" \\\n  -d '{"model":"claude-sonnet-5","messages":[{"role":"user","content":"Ping"}]}'`,
	},
	{
		id: "openai-codex",
		name: "OpenAI Codex",
		icon: "/harnesses/codex.png",
		badge: "OpenAI /v1/responses",
		protocol: "Codex & Responses API",
		descEn: "OpenAI Codex CLI and automated responses agents. Supports /v1/responses.",
		descVi: "CLI Codex và các agent dùng Responses API. Hỗ trợ đầy đủ endpoint /v1/responses.",
		quickRun: (base, key) => `export OPENAI_BASE_URL="${base}/v1"\nexport OPENAI_API_KEY="${key}"\ncodex --model gpt-5.5`,
		persistZsh: (base, key) => `echo 'export OPENAI_BASE_URL="${base}/v1"' >> ~/.zshrc\necho 'export OPENAI_API_KEY="${key}"' >> ~/.zshrc\nsource ~/.zshrc`,
		configFile: { path: "~/.codex/config.toml", lang: "toml", content: (base, key) => `model = "gpt-5.5"\napi_base = "${base}/v1"\napi_key = "${key}"` },
		verify: (base, key) => `curl -fsSL "${base}/v1/responses" \\\n  -H "authorization: Bearer ${key}" \\\n  -H "content-type: application/json" \\\n  -d '{"model":"gpt-5.5","input":[{"role":"user","content":"Hi"}]}'`,
	},
	{
		id: "opencode",
		name: "OpenCode",
		icon: "/harnesses/opencode.png",
		badge: "Zen & OpenAI Chat",
		protocol: "OpenCode CLI / Desktop",
		descEn: "OpenCode CLI harness. Routes premium models and free stealth models seamlessly.",
		descVi: "Bộ công cụ OpenCode CLI. Hỗ trợ cả model có phí lẫn dàn model free stealth.",
		quickRun: (base, key) => `export OPENCODE_BASE_URL="${base}/v1"\nexport OPENCODE_API_KEY="${key}"\nopencode --model big-pickle`,
		persistZsh: (base, key) => `echo 'export OPENCODE_BASE_URL="${base}/v1"' >> ~/.zshrc\necho 'export OPENCODE_API_KEY="${key}"' >> ~/.zshrc\nsource ~/.zshrc`,
		configFile: { path: "~/.config/opencode/config.json", lang: "json", content: (base, key) => `{\n  "provider": "custom",\n  "baseUrl": "${base}/v1",\n  "apiKey": "${key}",\n  "model": "claude-sonnet-5"\n}` },
		verify: (base, key) => `curl -fsSL "${base}/v1/models" -H "authorization: Bearer ${key}"`,
	},
	{
		id: "hermes-agent",
		name: "Hermes Agent",
		icon: "/harnesses/hermes.png",
		badge: "OpenAI Chat",
		protocol: "Hermes Multi-Agent Framework",
		descEn: "Hermes autonomous agent loop. Routes via standard OpenAI chat completions.",
		descVi: "Khung điều phối agent Hermes. Kết nối qua cổng chat completions chuẩn OpenAI.",
		quickRun: (base, key) => `export HERMES_API_BASE="${base}/v1"\nexport HERMES_API_KEY="${key}"\nexport OPENAI_BASE_URL="${base}/v1"\nexport OPENAI_API_KEY="${key}"\nhermes -m gemini-3.8-flash`,
		persistZsh: (base, key) => `echo 'export HERMES_API_BASE="${base}/v1"' >> ~/.zshrc\necho 'export HERMES_API_KEY="${key}"' >> ~/.zshrc\necho 'export OPENAI_BASE_URL="${base}/v1"' >> ~/.zshrc\necho 'export OPENAI_API_KEY="${key}"' >> ~/.zshrc\nsource ~/.zshrc`,
		configFile: {
			path: "~/.hermes/config.yaml",
			lang: "yaml",
			content: (base, key) => `model:\n  default: "gemini-3.8-flash"\n  provider: "custom:mnrouter"\n\nproviders:\n  mnrouter:\n    name: "mnrouter"\n    base_url: "${base}/v1"\n    api_key: "${key}"\n    api_mode: "chat_completions"\n`,
		},
		verify: (base, key) => `curl -fsSL "${base}/v1/chat/completions" \\\n  -H "authorization: Bearer ${key}" \\\n  -H "content-type: application/json" \\\n  -d '{"model":"gemini-3.8-flash","messages":[{"role":"user","content":"Ping"}]}'`,
	},
	{
		id: "cursor",
		name: "Cursor",
		icon: "/harnesses/cursor.png",
		badge: "Editor / OpenAI Base",
		protocol: "Cursor AI IDE",
		descEn: "Configure Cursor to route all agent and tab completions through mnRouter.",
		descVi: "Cấu hình Cursor IDE để điều hướng toàn bộ model AI và chat qua mnRouter.",
		quickRun: (base, key) => `# In Cursor: Settings (Cmd+,) -> Models -> Override OpenAI Base URL\n# 1. Base URL: ${base}/v1\n# 2. API Key:  ${key}`,
		persistZsh: (_base, _key) => `# Recommended Cursor Models:\n# claude-sonnet-5, gpt-5.6-sol, gpt-5.5, gemini-3.8-flash, grok-4.6, big-pickle`,
		configFile: { path: "Cursor Settings (JSON)", lang: "json", content: (base, key) => `{\n  "cursor.openai.overrideBaseUrl": "${base}/v1",\n  "cursor.openai.apiKey": "${key}"\n}` },
		verify: (base, key) => `curl -fsSL "${base}/v1/models" -H "authorization: Bearer ${key}"`,
	},
	{
		id: "deepseek-tui",
		name: "DeepSeek TUI",
		icon: "/harnesses/deepseek-tui.png",
		badge: "Rust TUI Agent",
		protocol: "DeepSeek Terminal Agent",
		descEn: "DeepSeek Terminal Coding Agent (Rust TUI). Routes completions via OpenAI-compatible endpoint.",
		descVi: "DeepSeek Terminal Coding Agent (Rust TUI). Điều hướng mô hình qua endpoint OpenAI của mnRouter.",
		quickRun: (base, key) => `export DEEPSEEK_BASE_URL="${base}/v1"\nexport DEEPSEEK_API_KEY="${key}"\nexport OPENAI_BASE_URL="${base}/v1"\nexport OPENAI_API_KEY="${key}"\ndeepseek`,
		persistZsh: (base, key) => `echo 'export DEEPSEEK_BASE_URL="${base}/v1"' >> ~/.zshrc\necho 'export DEEPSEEK_API_KEY="${key}"' >> ~/.zshrc\nsource ~/.zshrc`,
		configFile: {
			path: "~/.deepseek/config.toml",
			lang: "toml",
			content: (base, key) => `provider = "openai"\n\n[providers.openai]\nbase_url = "${base}/v1"\napi_key = "${key}"\nmodel = "gemini-3.8-flash"\n`,
		},
		verify: (base, key) => `curl -fsSL "${base}/v1/chat/completions" \\\n  -H "authorization: Bearer ${key}" \\\n  -H "content-type: application/json" \\\n  -d '{"model":"gemini-3.8-flash","messages":[{"role":"user","content":"Ping"}]}'`,
	},
	{
		id: "pi",
		name: "Pi",
		icon: "/harnesses/pi.svg",
		badge: "AI Coding Agent",
		protocol: "Pi Coding Harness",
		descEn: "Configure Pi coding agent CLI to route all completions through mnRouter.",
		descVi: "Cấu hình công cụ dòng lệnh Pi (pi CLI) trỏ trực tiếp về endpoint mnRouter.",
		quickRun: (base, key) => `export PI_API_BASE="${base}/v1"\nexport PI_API_KEY="${key}"\nexport OPENAI_BASE_URL="${base}/v1"\nexport OPENAI_API_KEY="${key}"\nexport ANTHROPIC_BASE_URL="${base}"\nexport ANTHROPIC_API_KEY="${key}"`,
		persistZsh: (base, key) => `echo 'export PI_API_BASE="${base}/v1"' >> ~/.zshrc\necho 'export PI_API_KEY="${key}"' >> ~/.zshrc\nsource ~/.zshrc`,
		configFile: { path: "~/.pi/config.json", lang: "json", content: (base, key) => `{\n  "baseUrl": "${base}/v1",\n  "apiKey": "${key}",\n  "defaultModel": "claude-sonnet-4-6"\n}` },
		verify: (base, key) => `curl -fsSL "${base}/v1/models" -H "authorization: Bearer ${key}"`,
	},
	{
		id: "omp",
		name: "OMP (Oh My Pi)",
		icon: "/harnesses/omp.svg",
		badge: "Multi-Agent Harness",
		protocol: "OMP Workspace Agent",
		descEn: "Configure Oh My Pi (OMP) harness environment and custom provider profiles for mnRouter.",
		descVi: "Cấu hình bộ công cụ Oh My Pi (OMP) trỏ toàn bộ agent và model sang mnRouter.",
		quickRun: (base, key) => `export OMP_BASE_URL="${base}/v1"\nexport OMP_API_KEY="${key}"\nexport OPENAI_BASE_URL="${base}/v1"\nexport OPENAI_API_KEY="${key}"\nexport ANTHROPIC_BASE_URL="${base}"\nexport ANTHROPIC_API_KEY="${key}"`,
		persistZsh: (base, key) => `echo 'export OMP_BASE_URL="${base}/v1"' >> ~/.zshrc\necho 'export OMP_API_KEY="${key}"' >> ~/.zshrc\nsource ~/.zshrc`,
		configFile: { path: "~/.omp/config.json", lang: "json", content: (base, key) => `{\n  "baseUrl": "${base}/v1",\n  "apiKey": "${key}",\n  "defaultModel": "claude-sonnet-4-6"\n}` },
		verify: (base, key) => `curl -fsSL "${base}/v1/models" -H "authorization: Bearer ${key}"`,
	},
	{
		id: "zcode",
		name: "ZCode",
		icon: "/harnesses/zcode.webp",
		badge: "Custom Model Provider",
		protocol: "IDE Model Provider",
		descEn: "Add mnRouter as custom model provider in ZCode settings.",
		descVi: "Thêm mnRouter làm Custom Model Provider trong cài đặt ZCode theo từng khung thông tin bên dưới.",
		quickRun: (base, key) => `# In ZCode: Settings -> Add model provider\n# Name: MNRouter\n# Base URL: ${base}/v1\n# API key: ${key}\n# API format: Anthropic messages (/v1/messages) or OpenAI chat completions (/v1/chat/completions)`,
		persistZsh: (_base, _key) => `# Recommended Models to add in ZCode:\n# claude-sonnet-4-6, claude-opus-4-6-ag, gemini-3.8-flash, gpt-5.5, muse-spark-1.3-contributor-free`,
		configFile: {
			path: "ZCode Provider Config",
			lang: "json",
			content: (base, key) => `{\n  "name": "MNRouter",\n  "baseUrl": "${base}/v1",\n  "apiKey": "${key}",\n  "apiFormat": "Anthropic messages (/v1/messages)",\n  "models": ["claude-sonnet-4-6", "claude-opus-4-6-ag", "gemini-3.8-flash", "gpt-5.5"]\n}`,
		},
		verify: (base, key) => `curl -fsSL "${base}/v1/models" -H "authorization: Bearer ${key}"`,
	},
	{
		id: "antigravity",
		name: "Antigravity (MITM Proxy)",
		icon: "/harnesses/antigravity.png",
		badge: "MITM HTTPS Proxy",
		protocol: "Google Cloud Code Interception",
		descEn: "Local MITM HTTPS proxy intercepts cloudcode-pa.googleapis.com and redirects to mnRouter.",
		descVi: "Chạy MITM HTTPS Proxy nội bộ để chặn bắt cloudcode-pa.googleapis.com và chuyển hướng về mnRouter.",
		quickRun: (base, key) => `# 1. Setup Root CA & Hosts redirect (run once with sudo):\ncurl -fsSL "${base}/mitm-setup.sh?key=${key}" | sudo bash\n\n# 2. Start MITM proxy server:\nsudo bun run mitm start --key "${key}"`,
		persistZsh: (base, key) => `# Or run via HTTP Proxy environment:\nexport HTTP_PROXY="http://127.0.0.1:8443"\nexport HTTPS_PROXY="http://127.0.0.1:8443"`,
		configFile: { path: "/etc/hosts (redirect)", lang: "bash", content: () => "127.0.0.1 cloudcode-pa.googleapis.com\n127.0.0.1 daily-cloudcode-pa.googleapis.com" },
		verify: (base, key) => `curl -fsSL "${base}/v1/chat/completions" \\\n  -H "authorization: Bearer ${key}" \\\n  -H "content-type: application/json" \\\n  -d '{"model":"gemini-3.8-flash","messages":[{"role":"user","content":"Ping"}]}'`,
	},
	{
		id: "github-copilot",
		name: "GitHub Copilot (MITM Proxy)",
		icon: "/harnesses/copilot.png",
		badge: "MITM HTTPS Proxy",
		protocol: "VSCode Extension Interception",
		descEn: "Local MITM HTTPS proxy intercepts api.individual.githubcopilot.com and proxies to mnRouter.",
		descVi: "Chạy MITM HTTPS Proxy nội bộ để chặn bắt api.individual.githubcopilot.com từ VSCode và chuyển hướng về mnRouter.",
		quickRun: (base, key) => `# 1. Setup Root CA & Hosts redirect (run once with sudo):\ncurl -fsSL "${base}/mitm-setup.sh?key=${key}" | sudo bash\n\n# 2. Start MITM proxy server:\nsudo bun run mitm start --key "${key}"`,
		persistZsh: (base, key) => `# Or run via HTTP Proxy environment:\nexport HTTP_PROXY="http://127.0.0.1:8443"\nexport HTTPS_PROXY="http://127.0.0.1:8443"`,
		configFile: { path: "/etc/hosts (redirect)", lang: "bash", content: () => "127.0.0.1 api.individual.githubcopilot.com\n127.0.0.1 copilot-proxy.githubusercontent.com" },
		verify: (base, key) => `curl -fsSL "${base}/v1/models" -H "authorization: Bearer ${key}"`,
	},
	{
		id: "kiro-mitm",
		name: "Kiro (MITM Proxy)",
		icon: "/harnesses/kiro.png",
		badge: "MITM HTTPS Proxy",
		protocol: "AWS CodeWhisperer Interception",
		descEn: "Local MITM HTTPS proxy intercepts runtime.us-east-1.kiro.dev & codewhisperer and proxies to mnRouter.",
		descVi: "Chạy MITM HTTPS Proxy nội bộ để chặn bắt codewhisperer và runtime.us-east-1.kiro.dev về mnRouter.",
		quickRun: (base, key) => `# 1. Setup Root CA & Hosts redirect (run once with sudo):\ncurl -fsSL "${base}/mitm-setup.sh?key=${key}" | sudo bash\n\n# 2. Start MITM proxy server:\nsudo bun run mitm start --key "${key}"`,
		persistZsh: (base, key) => `# Or run via HTTP Proxy environment:\nexport HTTP_PROXY="http://127.0.0.1:8443"\nexport HTTPS_PROXY="http://127.0.0.1:8443"`,
		configFile: { path: "/etc/hosts (redirect)", lang: "bash", content: () => "127.0.0.1 runtime.us-east-1.kiro.dev\n127.0.0.1 codewhisperer.us-east-1.amazonaws.com" },
		verify: (base, key) => `curl -fsSL "${base}/v1/chat/completions" \\\n  -H "authorization: Bearer ${key}" \\\n  -H "content-type: application/json" \\\n  -d '{"model":"claude-sonnet-5-kiro","messages":[{"role":"user","content":"Ping"}]}'`,
	},
];

export function buildAllInOneExport(baseUrl: string, apiKey: string): string {
	return `# === mnRouter All-in-One CLI Environment ===
export MNROUTER_BASE_URL="${baseUrl}"
export MNROUTER_API_KEY="${apiKey}"

# Claude Code & Claude Cowork
export ANTHROPIC_BASE_URL="${baseUrl}"
export ANTHROPIC_API_KEY="${apiKey}"
export CLAUDE_BASE_URL="${baseUrl}"

# OpenAI Codex, OpenClaw, Cursor, Hermes
export OPENAI_BASE_URL="${baseUrl}/v1"
export OPENAI_API_KEY="${apiKey}"
export OPENCLAW_API_BASE="${baseUrl}/v1"
export OPENCLAW_API_KEY="${apiKey}"
export HERMES_API_BASE="${baseUrl}/v1"
export HERMES_API_KEY="${apiKey}"

# OpenCode
export OPENCODE_BASE_URL="${baseUrl}/v1"
export OPENCODE_API_KEY="${apiKey}"

# Devin & Antigravity
export DEVIN_API_BASE="${baseUrl}/v1"
export DEVIN_API_KEY="${apiKey}"
export GEMINI_API_BASE="${baseUrl}/v1"
export GEMINI_API_KEY="${apiKey}"
export ANTIGRAVITY_API_BASE="${baseUrl}/v1"
export ANTIGRAVITY_API_KEY="${apiKey}"

# GitHub Copilot & Kiro
export COPILOT_PROXY_URL="${baseUrl}/v1"
export KIRO_ENDPOINT="${baseUrl}"
export KIRO_API_KEY="${apiKey}"
`;
}
