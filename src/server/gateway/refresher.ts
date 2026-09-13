/** Background OAuth token refresher — quét mỗi 60s, refresh connection sắp hết hạn. */
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { providerConnections } from "../db/schema.js";
import { ensureFreshToken } from "./router.js";
import type { ProviderId } from "./registry.js";

let timer: ReturnType<typeof setInterval> | null = null;

export function startRefresher() {
	if (timer) return;
	timer = setInterval(() => {
		void refreshAll().catch((err) => console.error("[refresher]", err.message));
	}, 60_000);
	// run once shortly after boot
	setTimeout(() => void refreshAll().catch(() => {}), 10_000);
	console.log("[refresher] started (every 60s)");
}

export function stopRefresher() {
	if (timer) clearInterval(timer);
	timer = null;
}

export async function refreshAll(): Promise<{ refreshed: number; failed: number }> {
	const rows = await db.select().from(providerConnections).where(eq(providerConnections.isActive, true));
	let refreshed = 0;
	let failed = 0;
	for (const conn of rows) {
		const d = (conn.data ?? {}) as Record<string, any>;
		const expiresAt = typeof d.expiresAt === "number" ? d.expiresAt : d.expiresAt ? new Date(d.expiresAt).getTime() : undefined;
		// chỉ refresh khi còn dưới 2h hoặc đã hết hạn
		if (!expiresAt || expiresAt - Date.now() > 2 * 60 * 60 * 1000) continue;
		try {
			await ensureFreshToken(conn);
			refreshed++;
			console.log(`[refresher] refreshed ${conn.provider}/${conn.label}`);
		} catch (err) {
			failed++;
			console.error(`[refresher] failed ${conn.provider}/${conn.label}: ${(err as Error).message}`);
		}
	}
	return { refreshed, failed };
}

export type { ProviderId };
