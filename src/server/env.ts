import { z } from "zod";
import "dotenv/config";

const schema = z.object({
	PORT: z.coerce.number().default(8787),
	APP_URL: z.string().default("http://localhost:5173"),
	DATABASE_URL: z.string().default("./data/mnrouter.db"),
	SESSION_SECRET: z.string().default("dev-secret-change-me"),
	SMTP_HOST: z.string().default("smtp.mail.me.com"),
	SMTP_PORT: z.coerce.number().default(587),
	SMTP_USER: z.string().optional(),
	SMTP_PASS: z.string().optional(),
	MAIL_FROM: z.string().default("MNRouter <system@mncuchiinhuttt.dev>"),
	ADMIN_EMAIL: z.string().optional(),
	OPENCODE_ZEN_TOKEN: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
	console.error("[env] invalid environment:", parsed.error.flatten().fieldErrors);
	process.exit(1);
}

export const env = parsed.data;
export const isProd = process.env.NODE_ENV === "production";
