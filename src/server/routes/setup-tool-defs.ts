import { DEFAULT_MODELS } from "../gateway/models.js";

export interface ToolDef {
	id: string;
	name: string;
	vars: [string, string][];
	files?: { path: string; content: string }[];
}

export function getToolDefs(
	base: string,
	key: string,
	modelsList?: Array<{ id: string; displayName?: string; contextWindow?: number; maxOutput?: number }>,
	isWindows = false
): Record<string, ToolDef> {
	const v1 = `${base}/v1`;
	const mList = modelsList && modelsList.length > 0 ? modelsList : DEFAULT_MODELS;
	const ompModels = mList
		.map((m) => `      - id: "${m.id}"\n        name: "${m.displayName || m.id}"\n        contextWindow: ${m.contextWindow || 1000000}\n        maxTokens: ${m.maxOutput || 65536}`)
		.join("\n");
	const piModels = mList.map((m) => `          { "id": "${m.id}", "name": "${m.displayName || m.id}" }`).join(",\n");
	const opencodeModels = mList.map((m) => `    "${m.id}"`).join(",\n");

	const H = isWindows ? "$userProfile\\" : "$HOME/";
	const S = isWindows ? "\\" : "/";

	return {
		"claude-code": {
			id: "claude-code",
			name: "Claude Code",
			vars: [
				["ANTHROPIC_BASE_URL", base],
				["ANTHROPIC_API_KEY", key],
			],
			files: [
				{ path: `${H}.claude${S}config.json`, content: `{\n  "defaultModel": "claude-sonnet-4-6-ag",\n  "alwaysApproveResets": true\n}` },
				{ path: `${H}.claude.json`, content: `{\n  "defaultModel": "claude-sonnet-4-6-ag",\n  "alwaysApproveResets": true\n}` },
			],
		},
		"claude-cowork": {
			id: "claude-cowork",
			name: "Claude Cowork",
			vars: [
				["ANTHROPIC_BASE_URL", base],
				["ANTHROPIC_API_KEY", key],
				["CLAUDE_BASE_URL", base],
			],
			files: isWindows
				? [{ path: `$userProfile\\AppData\\Roaming\\Claude\\claude_desktop_config.json`, content: `{\n  "env": { "ANTHROPIC_BASE_URL": "${base}", "ANTHROPIC_API_KEY": "${key}" }\n}` }]
				: [
						{ path: `$HOME/Library/Application Support/Claude/claude_desktop_config.json`, content: `{\n  "env": { "ANTHROPIC_BASE_URL": "${base}", "ANTHROPIC_API_KEY": "${key}" }\n}` },
						{ path: `$HOME/.config/Claude/claude_desktop_config.json`, content: `{\n  "env": { "ANTHROPIC_BASE_URL": "${base}", "ANTHROPIC_API_KEY": "${key}" }\n}` },
				  ],
		},
		openclaw: {
			id: "openclaw",
			name: "OpenClaw",
			vars: [
				["OPENCLAW_API_BASE", v1],
				["OPENCLAW_API_KEY", key],
				["OPENAI_BASE_URL", v1],
				["OPENAI_API_KEY", key],
			],
			files: [
				{ path: `${H}.openclaw${S}config.json`, content: `{\n  "baseUrl": "${v1}",\n  "apiKey": "${key}",\n  "defaultModel": "claude-sonnet-4-6-ag"\n}` },
				{ path: `${H}.config${S}openclaw${S}config.json`, content: `{\n  "baseUrl": "${v1}",\n  "apiKey": "${key}",\n  "defaultModel": "claude-sonnet-4-6-ag"\n}` },
			],
		},
		"openai-codex": {
			id: "openai-codex",
			name: "OpenAI Codex",
			vars: [
				["OPENAI_BASE_URL", v1],
				["OPENAI_API_KEY", key],
			],
			files: [{ path: `${H}.codex${S}config.toml`, content: `model = "gpt-5.5"\napi_base = "${v1}"\napi_key = "${key}"` }],
		},
		opencode: {
			id: "opencode",
			name: "OpenCode",
			vars: [
				["OPENCODE_BASE_URL", v1],
				["OPENCODE_API_KEY", key],
				["OPENAI_BASE_URL", v1],
				["OPENAI_API_KEY", key],
			],
			files: [
				{ path: `${H}.config${S}opencode${S}config.json`, content: `{\n  "provider": "custom",\n  "baseUrl": "${v1}",\n  "apiKey": "${key}",\n  "model": "claude-sonnet-4-6-ag",\n  "models": [\n${opencodeModels}\n  ]\n}` },
				{ path: `${H}.opencode${S}config.json`, content: `{\n  "provider": "custom",\n  "baseUrl": "${v1}",\n  "apiKey": "${key}",\n  "model": "claude-sonnet-4-6-ag",\n  "models": [\n${opencodeModels}\n  ]\n}` },
			],
		},
		"hermes-agent": {
			id: "hermes-agent",
			name: "Hermes Agent",
			vars: [
				["HERMES_API_BASE", v1],
				["HERMES_API_KEY", key],
				["OPENAI_BASE_URL", v1],
				["OPENAI_API_KEY", key],
			],
			files: [
				{ path: `${H}.hermes${S}config.yaml`, content: `api_base: "${v1}"\napi_key: "${key}"\ndefault_model: "claude-sonnet-4-6-ag"` },
				{ path: `${H}.config${S}hermes${S}config.yaml`, content: `api_base: "${v1}"\napi_key: "${key}"\ndefault_model: "claude-sonnet-4-6-ag"` },
			],
		},
		cursor: {
			id: "cursor",
			name: "Cursor",
			vars: [
				["CURSOR_OPENAI_BASE_URL", v1],
				["OPENAI_BASE_URL", v1],
				["OPENAI_API_KEY", key],
			],
		},
		"devin-cli": {
			id: "devin-cli",
			name: "Devin CLI",
			vars: [
				["DEVIN_API_BASE", v1],
				["DEVIN_API_KEY", key],
				["OPENAI_BASE_URL", v1],
				["OPENAI_API_KEY", key],
			],
		},
		pi: {
			id: "pi",
			name: "Pi",
			vars: [
				["PI_API_BASE", v1],
				["PI_API_KEY", key],
				["OPENAI_BASE_URL", v1],
				["OPENAI_API_KEY", key],
				["ANTHROPIC_BASE_URL", base],
				["ANTHROPIC_API_KEY", key],
			],
			files: [
				{ path: `${H}.pi${S}agent${S}models.json`, content: `{\n  "providers": {\n    "mnrouter": {\n      "baseUrl": "${v1}",\n      "apiKey": "${key}",\n      "api": "openai-completions",\n      "models": [\n${piModels}\n      ]\n    }\n  }\n}` },
				{ path: `${H}.pi${S}models.json`, content: `{\n  "providers": {\n    "mnrouter": {\n      "baseUrl": "${v1}",\n      "apiKey": "${key}",\n      "api": "openai-completions",\n      "models": [\n${piModels}\n      ]\n    }\n  }\n}` },
			],
		},
		omp: {
			id: "omp",
			name: "OMP (Oh My Pi)",
			vars: [
				["OMP_BASE_URL", v1],
				["OMP_API_KEY", key],
				["OPENAI_BASE_URL", v1],
				["OPENAI_API_KEY", key],
				["ANTHROPIC_BASE_URL", base],
				["ANTHROPIC_API_KEY", key],
			],
			files: [
				{ path: `${H}.omp${S}agent${S}models.yml`, content: `providers:\n  mnrouter:\n    baseUrl: "${v1}"\n    apiKey: "${key}"\n    api: "openai-completions"\n    models:\n${ompModels}` },
				{ path: `${H}.omp${S}models.yml`, content: `providers:\n  mnrouter:\n    baseUrl: "${v1}"\n    apiKey: "${key}"\n    api: "openai-completions"\n    models:\n${ompModels}` },
			],
		},
		zcode: {
			id: "zcode",
			name: "ZCode",
			vars: [
				["ZCODE_API_BASE", v1],
				["ZCODE_API_KEY", key],
				["OPENAI_BASE_URL", v1],
				["OPENAI_API_KEY", key],
			],
		},
		antigravity: {
			id: "antigravity",
			name: "Antigravity (MITM Proxy)",
			vars: [
				["HTTP_PROXY", "http://127.0.0.1:8443"],
				["HTTPS_PROXY", "http://127.0.0.1:8443"],
				["NODE_EXTRA_CA_CERTS", `${H}.mnrouter${S}mitm${S}rootCA.crt`],
			],
		},
		"github-copilot": {
			id: "github-copilot",
			name: "GitHub Copilot (MITM Proxy)",
			vars: [
				["HTTP_PROXY", "http://127.0.0.1:8443"],
				["HTTPS_PROXY", "http://127.0.0.1:8443"],
				["NODE_EXTRA_CA_CERTS", `${H}.mnrouter${S}mitm${S}rootCA.crt`],
			],
			files: [{ path: `.vscode${S}settings.json`, content: `{\n  "http.proxy": "http://127.0.0.1:8443",\n  "http.proxyStrictSSL": false\n}` }],
		},
		"kiro-mitm": {
			id: "kiro-mitm",
			name: "Kiro (MITM Proxy)",
			vars: [
				["HTTP_PROXY", "http://127.0.0.1:8443"],
				["HTTPS_PROXY", "http://127.0.0.1:8443"],
				["NODE_EXTRA_CA_CERTS", `${H}.mnrouter${S}mitm${S}rootCA.crt`],
			],
		},
	};
}
