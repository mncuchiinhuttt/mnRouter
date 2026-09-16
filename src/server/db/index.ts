import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema.js";
import { initSqliteSchema } from "./init.js";
import { initChatSqliteSchema } from "./chat-init.js";
import { initMcpSqliteSchema } from "./mcp-init.js";
const raw = process.env.DATABASE_URL?.trim();
const dbPath = raw && !raw.startsWith("postgres://") && !raw.startsWith("postgresql://")
	? raw
	: "./data/mnrouter.db";

if (dbPath !== ":memory:") {
	try {
		mkdirSync(dirname(dbPath), { recursive: true });
	} catch {
		// directory might already exist
	}
}

export const sqlite = new Database(dbPath, { create: true });
sqlite.run("PRAGMA journal_mode = WAL;");
sqlite.run("PRAGMA foreign_keys = ON;");
sqlite.run("PRAGMA busy_timeout = 5000;");

initSqliteSchema(sqlite);
initChatSqliteSchema(sqlite);
initMcpSqliteSchema(sqlite);
try { sqlite.run("UPDATE models SET enabled = 0 WHERE provider IN ('kiro', 'grok');"); } catch {}

export const db = drizzle(sqlite, { schema });
export { schema };
