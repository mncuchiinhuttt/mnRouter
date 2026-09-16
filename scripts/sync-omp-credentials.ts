import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";

const OMP_DB_PATH = `${process.env.HOME}/.omp/agent/agent.db`;
const MNROUTER_DB_PATH = process.env.DATABASE_URL || "./data/mnrouter.db";

if (!existsSync(OMP_DB_PATH)) {
	console.error(`[sync-omp] OMP database not found at ${OMP_DB_PATH}`);
	process.exit(1);
}

const ompDb = new Database(OMP_DB_PATH, { readonly: true });
const mnDb = new Database(MNROUTER_DB_PATH);

console.log(`[sync-omp] Reading credentials from OMP (${OMP_DB_PATH})...`);
const ompRows = ompDb
	.query("SELECT id, provider, identity_key, data FROM auth_credentials WHERE provider = 'google-antigravity'")
	.all() as { id: number; provider: string; identity_key: string | null; data: string }[];

let maxPriority = 90;
const currentConns = mnDb
	.query("SELECT priority, label, data FROM provider_connections WHERE provider = 'antigravity'")
	.all() as { priority: number; label: string; data: string }[];

const existingLabels = new Set(currentConns.map((c) => c.label));
for (const c of currentConns) {
	if (c.priority > maxPriority) maxPriority = c.priority;
}

let added = 0;
let updated = 0;

for (const row of ompRows) {
	try {
		const d = JSON.parse(row.data);
		const email = d.email || (row.identity_key ? row.identity_key.replace(/^email:/, "") : null);
		if (!email) continue;

		const accessToken = d.access || d.accessToken;
		const refreshToken = d.refresh || d.refreshToken;
		const projectId = d.projectId || "aicode-consumers";
		const expiresAt = d.expires || d.expiresAt || Date.now() + 3600 * 1000;

		const connData = {
			accessToken,
			refreshToken,
			projectId,
			expiresAt,
			email,
		};

		if (!existingLabels.has(email)) {
			maxPriority += 10;
			const id = crypto.randomUUID();
			mnDb
				.query(
					`INSERT INTO provider_connections (id, provider, label, auth_type, priority, is_active, status, data, created_at, updated_at)
					 VALUES (?, 'antigravity', ?, 'oauth', ?, 1, 'active', ?, ?, ?)`,
				)
				.run(id, email, maxPriority, JSON.stringify(connData), Date.now(), Date.now());
			added++;
			console.log(`  + Added new Antigravity account: ${email} (P:${maxPriority})`);
		} else {
			// Update tokens if present
			if (accessToken && refreshToken) {
				mnDb
					.query("UPDATE provider_connections SET data = ?, updated_at = ? WHERE provider = 'antigravity' AND label = ?")
					.run(JSON.stringify(connData), Date.now(), email);
				updated++;
				console.log(`  ~ Refreshed tokens for: ${email}`);
			}
		}
	} catch (err) {
		console.error(`  ! Error processing row ${row.id}:`, (err as Error).message);
	}
}

mnDb.run("PRAGMA wal_checkpoint(TRUNCATE);");
console.log(`[sync-omp] Done. Added ${added} new accounts, updated ${updated} existing accounts.`);
