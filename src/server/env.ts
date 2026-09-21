import { z } from "zod";
import "dotenv/config";

const schema = z.object({
	PORT: z.coerce.number().default(8787),
	APP_URL: z.string().default("http://localhost:5173"),
	DATABASE_URL: z.string().default("./data/mnrouter.db"),
	SESSION_SECRET: z.string().min(32).optional(),
	SMTP_HOST: z.string().default("smtp.mail.me.com"),
	SMTP_PORT: z.coerce.number().default(587),
	SMTP_USER: z.string().optional(),
	SMTP_PASS: z.string().optional(),
	MAIL_FROM: z.string().default("MNRouter <system@mncuchiinhuttt.dev>"),
	ADMIN_EMAIL: z.string().optional(),
	OPENCODE_ZEN_TOKEN: z.string().optional(),
});

export function parseEnvironment(raw: NodeJS.ProcessEnv = process.env) {
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		return { ok: false as const, errors: parsed.error.flatten().fieldErrors };
	}
	if (raw.NODE_ENV === "production" && !parsed.data.SESSION_SECRET) {
		return { ok: false as const, errors: { SESSION_SECRET: ["Required in production"] } };
	}
	return {
		ok: true as const,
		data: {
			...parsed.data,
			SESSION_SECRET: parsed.data.SESSION_SECRET ?? "dev-secret-change-me",
		},
	};
}

const parsed = parseEnvironment();
if (!parsed.ok) {
	console.error("[env] invalid environment:", parsed.errors);
	process.exit(1);
}

export const env = parsed.data;
export const isProd = process.env.NODE_ENV === "production";
