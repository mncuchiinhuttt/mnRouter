/**
 * An toàn 100%: Chỉ đồng bộ bảng `provider_connections` từ máy dev sang server.
 * KHÔNG BAO GIỜ ghi đè hay thay thế file `mnrouter.db`.
 * Giữ nguyên 100% users, invitations, api keys, chat threads, messages.
 *
 * Chạy: bun run scripts/sync-connections-to-server.ts [remote_host]
 */
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";

const REMOTE = process.argv[2] || "my-server";
const LOCAL_DB = "./data/mnrouter.db";
const REMOTE_DB = "/opt/mnrouter/data/mnrouter.db";

if (!existsSync(LOCAL_DB)) {
	console.error(`Local database not found at ${LOCAL_DB}`);
	process.exit(1);
}

// 1. Sync from OMP to local DB first if OMP is present
const OMP_DB = `${process.env.HOME}/.omp/agent/agent.db`;
if (existsSync(OMP_DB)) {
	console.log("==> 1. Syncing fresh credentials from local OMP...");
	const proc = Bun.spawnSync(["bun", "run", "scripts/sync-omp-credentials.ts"]);
	if (proc.stdout) console.log(proc.stdout.toString().trim());
}

// 2. Read local connections
console.log(`==> 2. Reading connections from local database (${LOCAL_DB})...`);
const localDb = new Database(LOCAL_DB, { readonly: true });
const connections = localDb
	.query("SELECT provider, label, auth_type, priority, is_active, status, data FROM provider_connections")
	.all() as {
	provider: string;
	label: string;
	auth_type: string;
	priority: number;
	is_active: number;
	status: string;
	data: string;
}[];

console.log(`Found ${connections.length} connections to sync.`);

// 3. Transfer via SSH python upsert directly into remote DB
console.log(`==> 3. Safely syncing to ${REMOTE}:${REMOTE_DB}...`);
const payloadJson = JSON.stringify(connections);

const pyScript = `
import sqlite3, json, sys

payload = json.loads(sys.stdin.read())
db_path = "${REMOTE_DB}"

con = sqlite3.connect(db_path)
con.execute("PRAGMA journal_mode = WAL;")
cur = con.cursor()

inserted = 0
updated = 0

for item in payload:
    provider = item["provider"]
    label = item["label"]
    cur.execute("SELECT id FROM provider_connections WHERE provider = ? AND label = ?", (provider, label))
    row = cur.fetchone()
    if row:
        cur.execute("""
            UPDATE provider_connections
            SET data = ?, priority = ?, is_active = ?, updated_at = strftime('%s','now')*1000
            WHERE provider = ? AND label = ?
        """, (item["data"], item["priority"], item["is_active"], provider, label))
        updated += 1
    else:
        import uuid
        new_id = str(uuid.uuid4())
        now_ms = int(time.time() * 1000) if "time" in locals() else 0
        cur.execute("""
            INSERT INTO provider_connections (id, provider, label, auth_type, priority, is_active, status, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now')*1000, strftime('%s','now')*1000)
        """, (new_id, provider, label, item["auth_type"], item["priority"], item["is_active"], item["status"], item["data"]))
        inserted += 1

con.commit()
print(f"Sync complete: {inserted} inserted, {updated} updated in {db_path} (Users and keys completely untouched).")
`;

const proc = Bun.spawn(["ssh", REMOTE, `python3 -c '${pyScript.replace(/'/g, "'\\''")}'`], {
	stdin: "pipe",
	stdout: "inherit",
	stderr: "inherit",
});

proc.stdin.write(payloadJson);
proc.stdin.end();

const code = await proc.exited;
if (code === 0) {
	console.log(`==> 4. Triggering refresher on ${REMOTE}...`);
	Bun.spawnSync(["ssh", REMOTE, "pkill -9 mnrouter || true"]);
	console.log("==> ✅ All OAuth connections synced safely without touching any user data!");
} else {
	console.error(`==> Failed with exit code ${code}`);
	process.exit(code);
}
