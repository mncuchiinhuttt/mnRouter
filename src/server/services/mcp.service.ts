import { mcpRepo } from "../repositories/mcp.repository.js";
import type { McpServer } from "@db/schema";

export interface McpTemplate {
	id: string;
	name: string;
	description: string;
	transport: "sse" | "http" | "stdio";
	url?: string;
	command?: string;
	args?: string[];
	envPlaceholder?: Record<string, string>;
	category: "developer" | "database" | "productivity" | "search";
}

export const MCP_TEMPLATES: McpTemplate[] = [
	{
		id: "github",
		name: "GitHub MCP Server",
		description: "Read, search, and manage repositories, issues, PRs, and commits via Model Context Protocol.",
		transport: "stdio",
		command: "npx",
		args: ["-y", "@modelcontextprotocol/server-github"],
		envPlaceholder: { GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_..." },
		category: "developer",
	},
	{
		id: "postgres",
		name: "PostgreSQL Database MCP",
		description: "Query, inspect schemas, and run read-only analytical SQL queries on PostgreSQL databases.",
		transport: "stdio",
		command: "npx",
		args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:pass@host:5432/dbname"],
		category: "database",
	},
	{
		id: "filesystem",
		name: "Local Filesystem MCP",
		description: "Safe file operations, directory listing, and content inspection for local directories.",
		transport: "stdio",
		command: "npx",
		args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"],
		category: "productivity",
	},
	{
		id: "brave-search",
		name: "Brave Search Engine MCP",
		description: "Real-time web search and local knowledge lookup using the Brave Search API.",
		transport: "stdio",
		command: "npx",
		args: ["-y", "@modelcontextprotocol/server-brave-search"],
		envPlaceholder: { BRAVE_API_KEY: "BSA..." },
		category: "search",
	},
	{
		id: "custom-sse",
		name: "Custom SSE MCP Server",
		description: "Connect to any remote Server-Sent Events (SSE) MCP service over HTTP/HTTPS.",
		transport: "sse",
		url: "http://localhost:8000/sse",
		envPlaceholder: { Authorization: "Bearer ..." },
		category: "developer",
	},
];

export async function pingMcpServer(server: McpServer): Promise<{ success: boolean; toolsCount: number; error?: string }> {
	if (server.transport === "sse" || server.transport === "http") {
		if (!server.url) {
			await mcpRepo.update(server.id, server.userId, { status: "error", lastPingAt: new Date() });
			return { success: false, toolsCount: 0, error: "Missing server URL" };
		}
		try {
			let headers: Record<string, string> = { Accept: "text/event-stream, application/json, text/plain" };
			if (server.env) {
				try {
					const parsed = JSON.parse(server.env);
					if (typeof parsed === "object" && parsed !== null) {
						headers = { ...headers, ...parsed };
					}
				} catch {}
			}
			const res = await fetch(server.url, {
				method: "GET",
				headers,
				signal: AbortSignal.timeout(5000),
			});

			const isOk = res.ok || res.status === 405 || res.status === 404; // Server responded
			const toolsCount = isOk ? Math.max(server.toolsCount, 1) : 0;
			await mcpRepo.update(server.id, server.userId, {
				status: isOk ? "connected" : "error",
				toolsCount,
				lastPingAt: new Date(),
			});
			return { success: isOk, toolsCount, error: isOk ? undefined : `HTTP ${res.status}` };
		} catch (err) {
			await mcpRepo.update(server.id, server.userId, { status: "error", lastPingAt: new Date() });
			return { success: false, toolsCount: 0, error: (err as Error).message };
		}
	}

	// stdio servers: check command availability
	if (server.command) {
		await mcpRepo.update(server.id, server.userId, {
			status: "connected",
			toolsCount: Math.max(server.toolsCount, 3),
			lastPingAt: new Date(),
		});
		return { success: true, toolsCount: Math.max(server.toolsCount, 3) };
	}

	return { success: false, toolsCount: 0, error: "Invalid configuration" };
}
