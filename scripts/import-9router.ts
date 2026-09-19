/**
 * Import connections từ 9router (SQLite ~/.9router/db/data.sqlite) vào MNRouter.
 * Dùng: bun scripts/import-9router.ts [path-to-data.sqlite]
 */
import "dotenv/config";
import { connectionRepo } from "../src/server/repositories/model.repository.js";
import { Database } from "bun:sqlite";

const sqlitePath = process.argv[2] ?? `${process.env.HOME}/.9router/db/data.sqlite`;
const TARGET_PROVIDER: Record<string, string> = {
	"gemini-cli": "antigravity",
	antigravity: "antigravity",
	kiro: "kiro",
};

let rows: Record<string, any>[] = [];
try {
	const sqlite = new Database(sqlitePath, { readonly: true });
	rows = sqlite.query("SELECT id, provider, authType, name, priority, isActive, data FROM providerConnections").all() as Record<string, any>[];
} catch (e) {
	console.error(`Không thể đọc file sqlite tại ${sqlitePath}: ${(e as Error).message}`);
	process.exit(1);
}

let imported = 0;
for (const row of rows) {
	const provider = TARGET_PROVIDER[row.provider];
	if (!provider) continue;
	let data: Record<string, any> = {};
	try {
		data = JSON.parse(row.data ?? "{}");
	} catch {
		continue;
	}
	const accessToken = data.accessToken;
	const refreshToken = data.refreshToken;
	if (!accessToken && !refreshToken) continue;

	const expiresAt = (() => {
		const v = data.expiresAt;
		if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
		if (typeof v === "string") {
			const ms = new Date(v).getTime();
			return Number.isFinite(ms) ? ms : undefined;
		}
		return undefined;
	})();

	const email = row.email || data.email || row.name || "account";
	const psd = data.providerSpecificData || {};
	await connectionRepo.create({
		id: crypto.randomUUID(),
		provider: provider as any,
		label: `${provider === "kiro" ? "kiro" : "ag"}-${email}`.slice(0, 80),
		authType: "oauth",
		priority: row.priority ?? 50,
		isActive: true,
		status: "active",
		data: {
			accessToken,
			refreshToken,
			expiresAt,
			projectId: data.projectId || psd.projectId || undefined,
			email: row.email || data.email || undefined,
			ssoOnly: provider === "kiro" ? true : undefined,
			ssoClientId: provider === "kiro" ? psd.clientId : undefined,
			ssoClientSecret: provider === "kiro" ? psd.clientSecret : undefined,
			ssoRegion: provider === "kiro" ? (psd.region || "us-east-1") : undefined,
			authMethod: psd.authMethod || undefined,
		},
	});
	imported++;
	console.log(`+ imported ${provider}: ${row.name}`);
}
console.log(`\nXong: import ${imported}/${rows.length} connections từ ${sqlitePath}`);
process.exit(0);
