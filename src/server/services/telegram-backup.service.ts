/**
 * Service to create safe online snapshots of SQLite database and upload to Telegram.
 * Uses SQLite `VACUUM INTO` command, compresses via gzip, and sends via Telegram Bot API `sendDocument`.
 */
import { sqlite } from "../db/index.js";
import { telegramService } from "./telegram.service.js";
import { unlinkSync, statSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { env } from "../env.js";

export class TelegramBackupService {
	private timer: NodeJS.Timeout | null = null;
	private isBackingUp = false;

	/**
	 * Perform online SQLite database snapshot and upload to Telegram chat.
	 */
	async performBackup(chatIdOverride?: string): Promise<{ ok: boolean; message: string; sizeBytes?: number }> {
		if (this.isBackingUp) {
			return { ok: false, message: "A backup operation is already in progress." };
		}

		this.isBackingUp = true;
		const cfg = await telegramService.getConfig();
		const targetChatId = (chatIdOverride || cfg.chatId)?.trim();
		const botToken = cfg.botToken?.trim();

		if (!botToken || !targetChatId) {
			this.isBackingUp = false;
			return { ok: false, message: "Telegram botToken and chatId must be configured." };
		}

		const now = new Date();
		const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
		const tmpDbPath = `/tmp/mnrouter_backup_${dateStr}.db`;

		try {
			// 1. Safe online point-in-time snapshot using VACUUM INTO
			sqlite.run(`VACUUM INTO '${tmpDbPath}';`);

			// 2. Read and gzip compress
			const dbBuffer = readFileSync(tmpDbPath);
			const gzipped = gzipSync(dbBuffer, { level: 9 });
			const sizeBytes = gzipped.length;
			const sizeKb = (sizeBytes / 1024).toFixed(1);
			const origSizeKb = (dbBuffer.length / 1024).toFixed(1);

			// 3. Prepare Multipart Form Data for Telegram sendDocument
			const filename = `mnrouter_db_${dateStr}.db.gz`;
			const caption =
				`📦 <b>[mnRouter Database Backup]</b> (Hourly)\n\n` +
				`⏱ <b>Timestamp:</b> ${now.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}\n` +
				`💾 <b>Compressed Size:</b> ${sizeKb} KB (Original: ${origSizeKb} KB)\n` +
				`🌐 <b>Host:</b> <code>${env.APP_URL}</code>\n` +
				`🛡 <i>Snapshot safely taken via online SQLite VACUUM.</i>`;

			const form = new FormData();
			form.append("chat_id", targetChatId);
			form.append("caption", caption);
			form.append("parse_mode", "HTML");
			form.append(
				"document",
				new Blob([gzipped], { type: "application/gzip" }),
				filename,
			);

			const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
				method: "POST",
				body: form,
			});

			const data = (await res.json()) as any;
			if (!res.ok || !data.ok) {
				return { ok: false, message: data.description || `Telegram API error: HTTP ${res.status}` };
			}

			return { ok: true, message: `Backup uploaded successfully (${sizeKb} KB)`, sizeBytes };
		} catch (err) {
			return { ok: false, message: (err as Error).message };
		} finally {
			// 4. Always clean up temporary snapshot file
			try {
				unlinkSync(tmpDbPath);
			} catch {}
			this.isBackingUp = false;
		}
	}

	/**
	 * Start background schedule to backup hourly (every 60 minutes).
	 */
	startSchedule(): void {
		if (this.timer) return;

		// Run hourly backup (every 60 minutes)
		this.timer = setInterval(async () => {
			const cfg = await telegramService.getConfig();
			if (cfg.enabled) {
				console.log("[backup] Executing scheduled hourly database backup to Telegram...");
				const res = await this.performBackup();
				if (res.ok) {
					console.log(`[backup] Scheduled hourly backup succeeded: ${res.message}`);
				} else {
					console.error(`[backup] Scheduled hourly backup failed: ${res.message}`);
				}
			}
		}, 60 * 60 * 1000);
	}

	stopSchedule(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}
}

export const telegramBackupService = new TelegramBackupService();
