import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";
import * as schema from "./schema.js";

const client = postgres(env.DATABASE_URL, { max: 5, idle_timeout: 30, connect_timeout: 15 });

export const db = drizzle(client, { schema });
export { schema };
