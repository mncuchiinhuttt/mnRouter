import { DEFAULT_MODELS } from "../gateway/models.js";

export interface ToolDef {
	id: string;
	name: string;
	vars: [string, string][];
	files?: { path: string; content: string }[];
}

function buildCodexModelsCache(mList: Array<any>): string {
	const models = mList.map((m, idx) => ({
		slug: m.id,
		display_name: m.displayName || m.id,
		description: `${m.displayName || m.id} via mnRouter.`,
		default_reasoning_level: "medium",
		supported_reasoning_levels: [
			{ effort: "low", description: "Fast responses with lighter reasoning" },
			{ effort: "medium", description: "Balances speed and reasoning depth for everyday tasks" },
			{ effort: "high", description: "Greater reasoning depth for complex problems" },
			{ effort: "xhigh", description: "Extra high reasoning depth for complex problems" },
			{ effort: "max", description: "Maximum reasoning depth for the hardest problems" },
			{ effort: "ultra", description: "Maximum reasoning with automatic task delegation" },
		],
		shell_type: "unified_exec",
		visibility: "list",
		supported_in_api: true,
		priority: idx,
		additional_speed_tiers: ["fast"],
		service_tiers: [{ id: "priority", name: "Fast", description: "1.5x speed, increased usage" }],
		availability_nux: null,
		upgrade: null,
		model_messages: {
			instructions_template: "You are Codex, an agent based on GPT-5. You and the user share one workspace, and your job is to collaborate with them until their goal is genuinely handled.",
			instructions_variables: null,
			approvals: null,
			collaboration_modes: null,
			auto_review: null,
			permissions: null,
			multi_agent: null,
			token_budget: {
				enabled: false,
				use_history_notes_extension: false,
				reminder_threshold_tokens: 6144,
				reminder_message_template: "<context_window_reminder>Your current context window is nearly exhausted; only {n_remaining} tokens remain.</context_window_reminder>",
				guidance_message: "For tasks that may span context windows, use notes to maintain a concise checkpoint.",
				auto_compact_fallback_prompt: "<context_window_reminder>The current context window is exhausted.</context_window_reminder>",
				auto_compact_fallback_buffer_tokens: 16384,
			},
		},
		include_skills_usage_instructions: false,
		include_plugin_usage_instructions: true,
		include_apps_usage_instructions: true,
		default_reasoning_summary: "none",
		support_verbosity: true,
		default_verbosity: "low",
		apply_patch_tool_type: "freeform",
		web_search_tool_type: "text_and_image",
		truncation_policy: { mode: "tokens", limit: 10000 },
		supports_image_detail_original: true,
		context_window: m.contextWindow || 272000,
		max_context_window: m.contextWindow || 1000000,
		comp_hash: "3000",
		effective_context_window_percent: 95,
		experimental_supported_tools: [],
		input_modalities: ["text", "image"],
		supports_search_tool: true,
		supports_experimental_context: false,
		use_responses_lite: true,
		node_repl_auto_review_required: false,
		node_repl_disabled: false,
		tool_mode: "code_mode_only",
		multi_agent_version: "v2",
	}));

	return JSON.stringify({
		fetched_at: new Date().toISOString(),
		etag: `W/"mnrouter-${Date.now()}"`,
		client_version: "0.154.0",
		models,
	}, null, 2);
}
export function getToolDefs(
	base: string,
	key: string,
	modelsList?: Array<{ id: string; displayName?: string; contextWindow?: number; maxOutput?: number; priceIn?: number; priceOut?: number; priceCacheRead?: number; priceCacheWrite?: number }>,
	isWindows = false,
	selectedModel?: string,
	subagentModels?: { explore?: string; plan?: string; "general-purpose"?: string }
): Record<string, ToolDef> {
	const v1 = `${base}/v1`;
	const mList = modelsList && modelsList.length > 0 ? modelsList : DEFAULT_MODELS;
	const ompModels = mList
		.map((m) => {
			const i = Number(((m.priceIn ?? 0) / 100).toFixed(4)), o = Number(((m.priceOut ?? 0) / 100).toFixed(4));
			const cr = Number(((m.priceCacheRead ?? Math.round((m.priceIn ?? 0) * 0.1)) / 100).toFixed(4));
			const cw = Number(((m.priceCacheWrite ?? Math.round((m.priceIn ?? 0) * 1.25)) / 100).toFixed(4));
			return `      - id: "${m.id}"\n        name: "${m.displayName || m.id}"\n        contextWindow: ${m.contextWindow || 1000000}\n        maxTokens: ${m.maxOutput || 65536}\n        cost:\n          input: ${i}\n          output: ${o}\n          cacheRead: ${cr}\n          cacheWrite: ${cw}`;
		})
		.join("\n");
	const piModels = mList.map((m) => `          { "id": "${m.id}", "name": "${m.displayName || m.id}" }`).join(",\n");
	const opencodeModelsObj = mList
		.map((m) => `        "${m.id}": { "name": "${m.displayName || m.id}", "modalities": { "input": ["text", "image"], "output": ["text"] } }`)
		.join(",\n");

	const H = isWindows ? "$userProfile\\" : "$HOME/";
	const S = isWindows ? "\\" : "/";
	const chosenModel = selectedModel || "gemini-3.8-flash";
	const exploreModel = subagentModels?.explore || chosenModel;
	const planModel = subagentModels?.plan || chosenModel;

	return {
		"claude-code": {
			id: "claude-code",
			name: "Claude Code",
			vars: [["ANTHROPIC_BASE_URL", base], ["ANTHROPIC_API_KEY", key]],
			files: [
				{ path: `${H}.claude${S}config.json`, content: `{\n  "defaultModel": "claude-sonnet-4-6-ag",\n  "alwaysApproveResets": true\n}` },
				{ path: `${H}.claude.json`, content: `{\n  "defaultModel": "claude-sonnet-4-6-ag",\n  "alwaysApproveResets": true\n}` },
			],
		},
		"claude-cowork": {
			id: "claude-cowork",
			name: "Claude Cowork",
			vars: [["ANTHROPIC_BASE_URL", base], ["ANTHROPIC_API_KEY", key], ["CLAUDE_BASE_URL", base]],
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
			vars: [["OPENCLAW_API_BASE", v1], ["OPENCLAW_API_KEY", key]],
			files: [
				{
					path: `${H}.openclaw${S}openclaw.json`,
					content: `{\n  "models": {\n    "providers": {\n      "mnrouter": {\n        "baseUrl": "${v1}",\n        "apiKey": "${key}",\n        "api": "openai-completions",\n        "models": [\n${mList.map((m) => `          { "id": "${m.id}", "name": "${m.displayName || m.id}" }`).join(",\n")}\n        ]\n      }\n    }\n  },\n  "agents": {\n    "defaults": {\n      "model": { "primary": "mnrouter/gemini-3.8-flash" },\n      "models": {\n${mList.map((m) => `        "mnrouter/${m.id}": {}`).join(",\n")}\n      }\n    }\n  }\n}\n`,
				},
				{
					path: `${H}.openclaw${S}config.json`,
					content: `{\n  "baseUrl": "${v1}",\n  "apiKey": "${key}",\n  "defaultModel": "mnrouter/gemini-3.8-flash"\n}\n`,
				},
			],
		},
		"openai-codex": {
			id: "openai-codex",
			name: "OpenAI Codex",
			vars: [["OPENAI_BASE_URL", v1], ["OPENAI_API_KEY", key]],
			files: [
				{
					path: `${H}.codex${S}config.toml`,
					content: `model_provider = "mnrouter"\nmodel = "${mList.find((m) => m.id === "gemini-3.8-flash")?.id || mList[0]?.id || "gemini-3.8-flash"}"\nchatgpt_base_url = "${v1.replace(/\/v1\/?$/, "")}/backend-api/"\n\n[model_providers.mnrouter]\nname = "mnrouter"\nbase_url = "${v1}"\nexperimental_bearer_token = "${key}"\n`,
				},
				{
					path: `${H}.codex${S}models_cache.json`,
					content: buildCodexModelsCache(mList),
				},
			],
		},
		opencode: {
			id: "opencode",
			name: "OpenCode",
			vars: [["OPENCODE_BASE_URL", v1], ["OPENCODE_API_KEY", key]],
			files: [
				{
					path: `${H}.config${S}opencode${S}opencode.json`,
					content: `{\n  "$schema": "https://opencode.ai/config.json",\n  "model": "mnrouter/gemini-3.8-flash",\n  "provider": {\n    "mnrouter": {\n      "npm": "@ai-sdk/openai-compatible",\n      "options": {\n        "baseURL": "${v1}",\n        "apiKey": "${key}"\n      },\n      "models": {\n${opencodeModelsObj}\n      }\n    }\n  }\n}\n`,
				},
				{
					path: `${H}.opencode${S}opencode.json`,
					content: `{\n  "$schema": "https://opencode.ai/config.json",\n  "model": "mnrouter/gemini-3.8-flash",\n  "provider": {\n    "mnrouter": {\n      "npm": "@ai-sdk/openai-compatible",\n      "options": {\n        "baseURL": "${v1}",\n        "apiKey": "${key}"\n      },\n      "models": {\n${opencodeModelsObj}\n      }\n    }\n  }\n}\n`,
				},
			],
		},
		"hermes-agent": {
			id: "hermes-agent",
			name: "Hermes Agent",
			vars: [
				["HERMES_API_BASE", v1],
				["HERMES_API_KEY", key],
			],
			files: [
				{ path: `${H}.hermes${S}config.yaml`, content: `model:\n  default: "claude-sonnet-4-6-ag"\n  provider: "custom:mnrouter"\n\nproviders:\n  mnrouter:\n    name: "mnrouter"\n    base_url: "${v1}"\n    api_key: "${key}"\n    api_mode: "chat_completions"\n` },
				{ path: `${H}.config${S}hermes${S}config.yaml`, content: `model:\n  default: "claude-sonnet-4-6-ag"\n  provider: "custom:mnrouter"\n\nproviders:\n  mnrouter:\n    name: "mnrouter"\n    base_url: "${v1}"\n    api_key: "${key}"\n    api_mode: "chat_completions"\n` },
			],
		},
		cursor: {
			id: "cursor",
			name: "Cursor",
			vars: [
				["CURSOR_OPENAI_BASE_URL", v1],
			],
		},
		"grok-build": {
			id: "grok-build",
			name: "Grok Build",
			vars: [
				["GROK_API_BASE", v1],
				["GROK_API_KEY", key],
			],
			files: [
				{
					path: `${H}.grok${S}config.toml`,
					content: `[models]\ndefault = "mnrouter"\n\n[model.mnrouter]\nmodel = "${chosenModel}"\nbase_url = "${v1}"\nname = "mnRouter"\ndescription = "Routed via mnRouter gateway"\napi_backend = "chat_completions"\napi_key = "${key}"\n\n[subagents.models]\ngeneral-purpose = "mnrouter-general-purpose"\nexplore = "mnrouter-explore"\nplan = "mnrouter-plan"\n\n[model.mnrouter-general-purpose]\nmodel = "${chosenModel}"\nbase_url = "${v1}"\nname = "mnRouter general-purpose"\ndescription = "Routed via mnRouter gateway (general-purpose)"\napi_backend = "chat_completions"\napi_key = "${key}"\n\n[model.mnrouter-explore]\nmodel = "${exploreModel}"\nbase_url = "${v1}"\nname = "mnRouter explore"\ndescription = "Routed via mnRouter gateway (explore)"\napi_backend = "chat_completions"\napi_key = "${key}"\n\n[model.mnrouter-plan]\nmodel = "${planModel}"\nbase_url = "${v1}"\nname = "mnRouter plan"\ndescription = "Routed via mnRouter gateway (plan)"\napi_backend = "chat_completions"\napi_key = "${key}"\n`,
				},
			],
		},
		dsh: {
			id: "dsh",
			name: "DSH (DeepSeek Harness)",
			vars: [
				["DEEPSEEK_BASE_URL", v1],
				["DEEPSEEK_API_KEY", key],
			],
			files: [
				{
					path: `${H}.dsh${S}settings.yaml`,
					content: `llm-pi-ai:\n  providers:\n    mnrouter:\n      displayName: "MNRouter Gateway"\n      api: "openai-completions"\n      baseURL: "${v1}"\n      apiKeyEnv: "MNROUTER_API_KEY"\n      models:\n${mList.map((m) => `      - id: "${m.id}"\n        name: "${m.displayName || m.id}"`).join("\n")}\n`,
				},
				{
					path: `${H}.dsh${S}.credentials.yaml`,
					content: `version: 1\nrefs:\n  MNROUTER_API_KEY: "${key}"\n`,
				},
			],
		},
		pi: {
			id: "pi",
			name: "Pi",
			vars: [
				["PI_API_BASE", v1],
				["PI_API_KEY", key],
			],
			files: [
				{ path: `${H}.pi${S}agent${S}models.json`, content: `{\n  "providers": {\n    "mnrouter": {\n      "baseUrl": "${v1}",\n      "apiKey": "${key}",\n      "api": "openai-completions",\n      "models": [\n${piModels}\n      ]\n    }\n  }\n}` },
				{ path: `${H}.pi${S}models.json`, content: `{\n  "providers": {\n    "mnrouter": {\n      "baseUrl": "${v1}",\n      "apiKey": "${key}",\n      "api": "openai-completions",\n      "models": [\n${piModels}\n      ]\n    }\n  }\n}` },
				{ path: `${H}.pi${S}agent${S}extensions${S}mnrouter.ts`, content: `export default function (pi: any) {\n  pi.registerProvider("mnrouter", {\n    baseUrl: "${v1}",\n    apiKey: "${key}",\n    api: "openai-completions",\n    usage: {\n      id: "mnrouter",\n      async fetchUsage(params: any, ctx: any) {\n        try {\n          const fetchFn = ctx?.fetch || fetch;\n          const res = await fetchFn("${v1}/usage", { headers: { authorization: "Bearer ${key}" } });\n          if (!res.ok) return null;\n          const data = await res.json();\n          return data.reports?.[0] || null;\n        } catch { return null; }\n      }\n    }\n  });\n}` },
				{ path: `${H}.pi${S}agent${S}config.yml`, content: `extensions:\n  - "${H}.pi${S}agent${S}extensions${S}mnrouter.ts"\n` },
			],
		},
		omp: {
			id: "omp",
			name: "OMP (Oh My Pi)",
			vars: [
				["OMP_BASE_URL", v1],
				["OMP_API_KEY", key],
			],
			files: [
				{ path: `${H}.omp${S}agent${S}models.yml`, content: `providers:\n  mnrouter:\n    baseUrl: "${v1}"\n    apiKey: "${key}"\n    api: "openai-completions"\n    authHeader: true\n    quota:\n      enabled: true\n      endpoint: "${base}/dashboard/billing/usage"\n      interval: "10m"\n    models:\n${ompModels}` },
				{ path: `${H}.omp${S}models.yml`, content: `providers:\n  mnrouter:\n    baseUrl: "${v1}"\n    apiKey: "${key}"\n    api: "openai-completions"\n    authHeader: true\n    quota:\n      enabled: true\n      endpoint: "${base}/dashboard/billing/usage"\n      interval: "10m"\n    models:\n${ompModels}` },
				{ path: `${H}.omp${S}agent${S}extensions${S}mnrouter.ts`, content: `export default function (pi: any) {\n  pi.registerProvider("mnrouter", {\n    baseUrl: "${v1}",\n    apiKey: "${key}",\n    api: "openai-completions",\n    usage: {\n      id: "mnrouter",\n      async fetchUsage(params: any, ctx: any) {\n        try {\n          const fetchFn = ctx?.fetch || fetch;\n          const res = await fetchFn("${v1}/usage", { headers: { authorization: "Bearer ${key}" } });\n          if (!res.ok) return null;\n          const data = await res.json();\n          return data.reports?.[0] || null;\n        } catch { return null; }\n      }\n    }\n  });\n}` },
				{ path: `${H}.omp${S}agent${S}config.yml`, content: `extensions:\n  - "${isWindows ? "$userProfile/.omp/agent/extensions/mnrouter.ts" : "$HOME/.omp/agent/extensions/mnrouter.ts"}"\n` },
			],
		},
		zcode: {
			id: "zcode",
			name: "ZCode",
			vars: [
				["ZCODE_API_BASE", v1],
				["ZCODE_API_KEY", key],
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
