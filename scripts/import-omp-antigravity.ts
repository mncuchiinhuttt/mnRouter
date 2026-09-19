import "dotenv/config";
import { Database } from "bun:sqlite";
import { connectionRepo } from "../src/server/repositories/model.repository.js";
import { db } from "../src/server/db/index.js";
import { providerConnections } from "../src/server/db/schema.js";
import { eq } from "drizzle-orm";

const ompDbPath = process.argv[2] ?? `${process.env.HOME}/.omp/agent/agent.db`;

console.log(`[import-omp] Reading credentials from: ${ompDbPath}`);

const ompDb = new Database(ompDbPath, { readonly: true });
const rows = ompDb
	.query("SELECT id, provider, credential_type, data FROM auth_credentials WHERE provider = 'google-antigravity'")
	.all() as Array<{ id: number; provider: string; credential_type: string; data: string }>;

console.log(`[import-omp] Found ${rows.length} google-antigravity rows in OMP.`);

// Existing connections to prevent duplicates
const existing = await db
	.select()
	.from(providerConnections)
	.where(eq(providerConnections.provider, "antigravity"));
const existingLabels = new Set(existing.map((c) => c.label.toLowerCase()));

let importedCount = 0;
let skippedCount = 0;

for (const r of rows) {
	let data: Record<string, any> = {};
	try {
		data = JSON.parse(r.data);
	} catch {
		continue;
	}

	const email = (data.email || data.accountId || `account-${r.id}`).toLowerCase().trim();
	const accessToken = data.accessToken || data.access;
	const refreshToken = data.refreshToken || data.refresh;
	const projectId = data.projectId || "aicode-consumers";
	const expiresAt = typeof data.expiresAt === "number" ? data.expiresAt : typeof data.expires === "number" ? data.expires : undefined;

	if (!accessToken && !refreshToken) {
		console.log(`[skip] ${email} has neither access nor refresh token.`);
		continue;
	}

	if (existingLabels.has(email)) {
		skippedCount++;
		continue;
	}

	await connectionRepo.create({
		id: crypto.randomUUID(),
		provider: "antigravity",
		label: email,
		authType: "oauth",
		priority: 50,
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

	existingLabels.add(email);
	importedCount++;
	console.log(`+ [imported] ${email} (OMP id: ${r.id})`);
}

console.log(`\n[Done] Imported: ${importedCount} | Already existing: ${skippedCount}`);
process.exit(0);
