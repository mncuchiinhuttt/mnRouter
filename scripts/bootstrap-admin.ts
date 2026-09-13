/**
 * Bootstrap admin đầu tiên: `pnpm bootstrap admin@example.com`
 * Nếu DB chưa có user nào → tạo admin với email này.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../src/server/db/schema.js";
import { eq, sql } from "drizzle-orm";

const email = process.argv[2] ?? process.env.ADMIN_EMAIL;
if (!email || !email.includes("@")) {
	console.error("Usage: pnpm bootstrap <admin-email>");
	process.exit(1);
}

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema: { users } });

const countRows = await db.select({ count: sql<number>`COUNT(*)::int` }).from(users);
const count = countRows[0]?.count ?? 0;
if (count > 0) {
	const [existing] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
	if (existing) {
		console.log(`User ${email} đã tồn tại (role=${existing.role}).`);
		if (existing.role !== "admin") {
			await db.update(users).set({ role: "admin" }).where(eq(users.id, existing.id));
			console.log("→ Đã nâng lên admin.");
		}
	} else {
		console.log(`DB đã có ${count} user. Không tạo mới. Dùng pnpm bootstrap chỉ khi DB rỗng, hoặc tạo user trong UI admin.`);
	}
} else {
	const [admin] = await db
		.insert(users)
		.values({ email: email.toLowerCase(), role: "admin", maxApiKeys: 10, monthlyTokenBudget: null })
		.returning();
	console.log(`✅ Đã tạo admin: ${admin!.email} (id=${admin!.id})`);
	console.log("→ Mở portal và login bằng magic link với email này.");
}
await client.end();
