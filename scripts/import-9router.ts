/**
 * Import connections từ 9router (SQLite ~/.9router/db/data.sqlite) vào MNRouter.
 * Dùng: pnpm import-9router [path-to-data.sqlite]
 * Token trong 9router nằm plain JSON trong providerConnections.data.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { providerConnections } from "../src/server/db/schema.js";
import { DatabaseSync } from "node:sqlite";

const sqlitePath = process.argv[2] ?? `${process.env.HOME}/.9router/db/data.sqlite`;
const TARGET_PROVIDER: Record<string, string> = {
	claude: "claude",
	codex: "codex",
	"gemini-cli": "antigravity",
	antigravity: "antigravity",
	kiro: "kiro",
};

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema: { providerConnections } });

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const rows = sqlite.prepare("SELECT id, provider, authType, name, priority, isActive, data FROM providerConnections").all() as Record<string, any>[];

let imported = 0;
for (const row of rows) {
	const provider = TARGET_PROVIDER[row.provider];
	if (!provider) {
		console.log(`- skip ${row.provider}/${row.name} (không hỗ trợ)`);
		continue;
	}
	let data: Record<string, any> = {};
	try {
		data = JSON.parse(row.data ?? "{}");
	} catch {
		console.log(`- skip ${row.provider}/${row.name} (data không parse được)`);
		continue;
	}
	const accessToken = data.accessToken;
	const refreshToken = data.refreshToken;
	if (!accessToken && !refreshToken) {
		console.log(`- skip ${row.provider}/${row.name} (không có token)`);
		continue;
	}
	const expiresAt = (() => {
		const v = data.expiresAt;
		if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
		if (typeof v === "string") {
			const ms = new Date(v).getTime();
			return Number.isFinite(ms) ? ms : undefined;
		}
		return undefined;
	})();
	await db.insert(providerConnections).values({
		provider: provider as "claude",
		label: `9r-${row.name ?? row.provider}`.slice(0, 80),
		priority: row.priority ?? 100,
		isActive: Boolean(row.isActive),
		data: {
			accessToken,
			refreshToken,
			expiresAt,
			accountId: data.accountId ?? data.projectId ?? undefined,
			projectId: data.projectId ?? data.providerSpecificData?.projectId ?? undefined,
			email: data.email ?? undefined,
			profileArn: data.providerSpecificData?.profileArn ?? undefined,
			authMethod: data.providerSpecificData?.authMethod ?? undefined,
			ssoClientId: data.providerSpecificData?.clientId ?? undefined,
			ssoClientSecret: data.providerSpecificData?.clientSecret ?? undefined,
			ssoRegion: data.providerSpecificData?.region ?? "us-east-1",
		},
	});
	imported++;
	console.log(`+ imported ${provider}: ${row.name}`);
}
console.log(`\nXong: import ${imported}/${rows.length} connections từ ${sqlitePath}`);
await client.end();
