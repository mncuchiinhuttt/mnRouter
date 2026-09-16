import type { Database } from "bun:sqlite";

export function initMcpSqliteSchema(sqlite: Database): void {
	sqlite.run(`
		CREATE TABLE IF NOT EXISTS mcp_servers (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			transport TEXT NOT NULL DEFAULT 'sse',
			url TEXT,
			command TEXT,
			args TEXT,
			env TEXT,
			status TEXT NOT NULL DEFAULT 'disconnected',
			enabled INTEGER NOT NULL DEFAULT 1,
			tools_count INTEGER NOT NULL DEFAULT 0,
			last_ping_at INTEGER,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS custom_skills (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			slug TEXT NOT NULL,
			description TEXT,
			prompt TEXT NOT NULL,
			raw_markdown TEXT NOT NULL,
			icon TEXT NOT NULL DEFAULT 'Sparkles',
			enabled INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);

		CREATE INDEX IF NOT EXISTS mcp_servers_user_ix ON mcp_servers(user_id);
		CREATE INDEX IF NOT EXISTS custom_skills_user_ix ON custom_skills(user_id);
	`);
}
