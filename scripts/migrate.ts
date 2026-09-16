/** Chạy SQLite schema initialization bằng bun. */
import "dotenv/config";
import { sqlite } from "../src/server/db/index.js";
import { initSqliteSchema } from "../src/server/db/init.js";

initSqliteSchema(sqlite);
console.log("✅ SQLite schema initialized successfully");
process.exit(0);
