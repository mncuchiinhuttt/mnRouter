import type { Database } from "bun:sqlite";

export function initChatSqliteSchema(sqlite: Database): void {
	sqlite.run(`
		CREATE TABLE IF NOT EXISTS chat_threads (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			title TEXT NOT NULL DEFAULT 'New conversation',
			model TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS chat_messages (
			id TEXT PRIMARY KEY,
			thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
			role TEXT NOT NULL,
			content TEXT NOT NULL,
			file_ids TEXT,
			meta TEXT,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS chat_files (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			thread_id TEXT,
			filename TEXT NOT NULL,
			mime_type TEXT NOT NULL,
			size_bytes INTEGER NOT NULL,
			storage_path TEXT NOT NULL,
			expires_at INTEGER NOT NULL,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS chat_artifacts (
			id TEXT PRIMARY KEY,
			message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
			thread_id TEXT NOT NULL,
			identifier TEXT NOT NULL,
			type TEXT NOT NULL DEFAULT 'code',
			title TEXT NOT NULL,
			content TEXT NOT NULL,
			language TEXT,
			expires_at INTEGER NOT NULL,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS chat_shares (
			id TEXT PRIMARY KEY,
			thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token TEXT NOT NULL UNIQUE,
			title TEXT NOT NULL,
			expires_at INTEGER NOT NULL,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS chat_feedbacks (
			id TEXT PRIMARY KEY,
			message_id TEXT NOT NULL,
			thread_id TEXT NOT NULL,
			user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			user_email TEXT,
			model TEXT,
			reason TEXT NOT NULL,
			comment TEXT,
			message_preview TEXT,
			status TEXT NOT NULL DEFAULT 'new',
			created_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS chat_threads_user_ix ON chat_threads(user_id, updated_at);
		CREATE INDEX IF NOT EXISTS chat_messages_thread_ix ON chat_messages(thread_id, created_at);
		CREATE INDEX IF NOT EXISTS chat_files_user_ix ON chat_files(user_id);
		CREATE INDEX IF NOT EXISTS chat_files_expires_ix ON chat_files(expires_at);
		CREATE INDEX IF NOT EXISTS chat_artifacts_thread_ix ON chat_artifacts(thread_id);
		CREATE INDEX IF NOT EXISTS chat_artifacts_expires_ix ON chat_artifacts(expires_at);
		CREATE INDEX IF NOT EXISTS chat_shares_token_ix ON chat_shares(token);
		CREATE INDEX IF NOT EXISTS chat_shares_thread_ix ON chat_shares(thread_id);
		CREATE INDEX IF NOT EXISTS chat_shares_expires_ix ON chat_shares(expires_at);
	`);
}
