/**
 * Import all Google Antigravity accounts directly from OMP (Oh My Pi: ~/.omp/agent/agent.db).
 * Usage: bun scripts/import-omp.ts
 */
import { Database } from "bun:sqlite";
import path from "node:path";
import os from "node:os";
import { connectionRepo } from "../src/server/repositories/model.repository.js";
import { sqlite } from "../src/server/db/index.js";

const ompDbPath = path.join(os.homedir(), ".omp", "agent", "agent.db");

console.log(`== Reading OMP credentials from: ${ompDbPath} ==`);

let ompDb: Database;
try {
	ompDb = new Database(ompDbPath, { readonly: true });
} catch (err) {
	console.error(`Không thể mở OMP database: ${(err as Error).message}`);
	process.exit(1);
}

interface OmpCredRow {
	id: number;
	provider: string;
	credential_type: string;
	identity_key: string | null;
	data: string;
	disabled_cause: string | null;
}

const rows = ompDb
	.query("SELECT id, provider, credential_type, identity_key, data, disabled_cause FROM auth_credentials WHERE provider = 'google-antigravity'")
	.all() as OmpCredRow[];

console.log(`Tìm thấy ${rows.length} tài khoản Google Antigravity trong OMP.`);

// Clear existing antigravity connections in mnRouter to avoid duplicates
sqlite.run("DELETE FROM provider_connections WHERE provider = 'antigravity';");

let imported = 0;
for (let i = 0; i < rows.length; i++) {
	const row = rows[i]!;
	let credData: Record<string, any> = {};
	try {
		credData = JSON.parse(row.data);
	} catch {
		continue;
	}

	const email = credData.email || (row.identity_key ? row.identity_key.replace(/^email:/, "") : `account-${i + 1}`);
	const accessToken = credData.access;
	const refreshToken = credData.refresh;
	const projectId = credData.projectId;
	const expiresAt = credData.expires ? Number(credData.expires) : undefined;

	if (!refreshToken && !accessToken) {
		console.log(`- Bỏ qua ${email}: Không có token`);
		continue;
	}

	await connectionRepo.create({
		id: crypto.randomUUID(),
		provider: "antigravity",
		label: email,
		authType: "oauth",
		priority: (i + 1) * 10,
		isActive: true,
		status: "active",
		data: {
			accessToken,
			refreshToken,
			projectId,
			expiresAt,
			email,
		},
	});

	imported++;
	console.log(`+ [${imported}/${rows.length}] Đã import OMP Antigravity: ${email} (Project: ${projectId || "default"})`);
}

console.log(`\n🎉 Xong! Đã import thành công ${imported} tài khoản Google Antigravity từ OMP vào mnRouter.`);

const conns = sqlite.query("SELECT label, provider, priority, status FROM provider_connections WHERE provider = 'antigravity' ORDER BY priority ASC;").all();
console.log("\nDanh sách Antigravity connections hiện tại trong mnRouter:\n", conns);
process.exit(0);
