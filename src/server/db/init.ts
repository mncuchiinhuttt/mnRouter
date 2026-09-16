import type { Database } from "bun:sqlite";

export function initSqliteSchema(sqlite: Database): void {
	sqlite.run(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			role TEXT NOT NULL DEFAULT 'user',
			display_name TEXT,
			username TEXT UNIQUE,
			department TEXT,
			avatar_url TEXT,
			package_name TEXT,
			status TEXT NOT NULL DEFAULT 'active',
			max_api_keys INTEGER NOT NULL DEFAULT 1,
			monthly_token_budget INTEGER,
			monthly_credit_budget INTEGER,
			all_models INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL,
			disabled_at INTEGER
		);

		CREATE TABLE IF NOT EXISTS invitations (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL,
			token_hash TEXT NOT NULL UNIQUE,
			invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			max_api_keys INTEGER NOT NULL DEFAULT 1,
			package_name TEXT,
			monthly_token_budget INTEGER,
			monthly_credit_budget INTEGER,
			all_models INTEGER NOT NULL DEFAULT 1,
			allowed_models TEXT NOT NULL DEFAULT '[]',
			status TEXT NOT NULL DEFAULT 'pending',
			expires_at INTEGER NOT NULL,
			accepted_at INTEGER,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS magic_links (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL,
			token_hash TEXT NOT NULL UNIQUE,
			expires_at INTEGER NOT NULL,
			used_at INTEGER,
			ip TEXT,
			user_agent TEXT,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			token_hash TEXT NOT NULL UNIQUE,
			expires_at INTEGER NOT NULL,
			last_used_at INTEGER NOT NULL,
			ip TEXT,
			user_agent TEXT,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS api_keys (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name TEXT NOT NULL DEFAULT 'default',
			prefix TEXT NOT NULL,
			key_hash TEXT NOT NULL UNIQUE,
			created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			last_used_at INTEGER,
			revoked_at INTEGER,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS provider_connections (
			id TEXT PRIMARY KEY,
			provider TEXT NOT NULL,
			label TEXT NOT NULL,
			auth_type TEXT NOT NULL DEFAULT 'oauth',
			priority INTEGER NOT NULL DEFAULT 100,
			is_active INTEGER NOT NULL DEFAULT 1,
			status TEXT NOT NULL DEFAULT 'active',
			data TEXT NOT NULL DEFAULT '{}',
			base_url_override TEXT,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS models (
			id TEXT PRIMARY KEY,
			provider TEXT NOT NULL,
			upstream_model TEXT NOT NULL,
			display_name TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 1,
			priority INTEGER NOT NULL DEFAULT 100,
			context_window INTEGER NOT NULL DEFAULT 200000,
			max_output INTEGER NOT NULL DEFAULT 8192,
			price_in INTEGER NOT NULL DEFAULT 0,
			price_out INTEGER NOT NULL DEFAULT 0,
			price_cache_read INTEGER NOT NULL DEFAULT 0,
			price_cache_write INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS user_models (
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
			PRIMARY KEY (user_id, model_id)
		);

		CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS usage_requests (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ts INTEGER NOT NULL,
			user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
			provider TEXT NOT NULL,
			connection_id TEXT,
			model TEXT NOT NULL,
			endpoint TEXT NOT NULL,
			status TEXT NOT NULL,
			http_status INTEGER,
			prompt_tokens INTEGER NOT NULL DEFAULT 0,
			completion_tokens INTEGER NOT NULL DEFAULT 0,
			cache_read_tokens INTEGER NOT NULL DEFAULT 0,
			cache_write_tokens INTEGER NOT NULL DEFAULT 0,
			reasoning_tokens INTEGER NOT NULL DEFAULT 0,
			credits TEXT NOT NULL DEFAULT '0',
			latency_ms INTEGER,
			ttft_ms INTEGER,
			error_code TEXT,
			meta TEXT
		);

		CREATE TABLE IF NOT EXISTS usage_daily (
			date TEXT NOT NULL,
			user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
			provider TEXT NOT NULL,
			model TEXT NOT NULL,
			requests INTEGER NOT NULL DEFAULT 0,
			errors INTEGER NOT NULL DEFAULT 0,
			prompt_tokens INTEGER NOT NULL DEFAULT 0,
			completion_tokens INTEGER NOT NULL DEFAULT 0,
			cache_read_tokens INTEGER NOT NULL DEFAULT 0,
			cache_write_tokens INTEGER NOT NULL DEFAULT 0,
			credits TEXT NOT NULL DEFAULT '0',
			PRIMARY KEY (date, user_id, provider, model)
		);

		CREATE TABLE IF NOT EXISTS audit_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ts INTEGER NOT NULL,
			actor_user_id TEXT,
			action TEXT NOT NULL,
			target TEXT,
			data TEXT
		);

		CREATE TABLE IF NOT EXISTS announcements (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			content TEXT NOT NULL,
			type TEXT NOT NULL DEFAULT 'info',
			active INTEGER NOT NULL DEFAULT 1,
			expires_at INTEGER,
			created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);

		CREATE INDEX IF NOT EXISTS api_keys_prefix_ix ON api_keys(prefix);
		CREATE INDEX IF NOT EXISTS usage_requests_ts_ix ON usage_requests(ts);
		CREATE INDEX IF NOT EXISTS usage_requests_user_ts_ix ON usage_requests(user_id, ts);
		CREATE INDEX IF NOT EXISTS usage_requests_user_id_ix ON usage_requests(user_id, id DESC);
		CREATE INDEX IF NOT EXISTS usage_requests_status_id_ix ON usage_requests(status, id DESC);
		CREATE INDEX IF NOT EXISTS announcements_active_ix ON announcements(active, expires_at);
	`);

	try { sqlite.run("ALTER TABLE users ADD COLUMN username TEXT;"); } catch {}
	try { sqlite.run("ALTER TABLE users ADD COLUMN department TEXT;"); } catch {}
	try { sqlite.run("ALTER TABLE users ADD COLUMN avatar_url TEXT;"); } catch {}
	try { sqlite.run("ALTER TABLE users ADD COLUMN onboarded_at INTEGER;"); } catch {}
	try { sqlite.run("UPDATE users SET onboarded_at = created_at WHERE onboarded_at IS NULL AND username IS NOT NULL AND display_name IS NOT NULL;"); } catch {}
}
