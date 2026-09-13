/** Chạy drizzle migrations bằng bun (không cần drizzle-kit lúc deploy). */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
	console.error("Thiếu DATABASE_URL");
	process.exit(1);
}
const client = postgres(url, { max: 1 });
const db = drizzle(client);
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("✅ migrations applied");
await client.end();
