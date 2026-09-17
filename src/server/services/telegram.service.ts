import { settingsRepo } from "../repositories/settings.repository.js";
import { connectionService } from "./connection.service.js";
import { usageRepo } from "../repositories/usage.repository.js";

export interface TelegramConfig {
	botToken: string;
	chatId: string;
	enabled: boolean;
	notifyCooldown: boolean;
	notifyErrors: boolean;
	notifyNewUsers: boolean;
	notifyDailyReport: boolean;
}

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
	botToken: "",
	chatId: "",
	enabled: false,
	notifyCooldown: true,
	notifyErrors: true,
	notifyNewUsers: true,
	notifyDailyReport: false,
};

export class TelegramService {
	private lastCooldownAlerts = new Map<string, number>();

	async getConfig(): Promise<TelegramConfig> {
		const stored = await settingsRepo.get<TelegramConfig>("telegram");
		return { ...DEFAULT_TELEGRAM_CONFIG, ...(stored || {}) };
	}

	async saveConfig(cfg: Partial<TelegramConfig>): Promise<TelegramConfig> {
		const current = await this.getConfig();
		const merged = { ...current, ...cfg };
		await settingsRepo.set("telegram", merged);
		return merged;
	}

	async sendMessage(text: string, tokenOverride?: string, chatIdOverride?: string): Promise<{ ok: boolean; error?: string }> {
		const cfg = await this.getConfig();
		const token = (tokenOverride || cfg.botToken)?.trim();
		const chatId = (chatIdOverride || cfg.chatId)?.trim();

		if (!token || !chatId) {
			return { ok: false, error: "Bot Token and Chat ID are required." };
		}

		try {
			const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					chat_id: chatId,
					text,
					parse_mode: "HTML",
					disable_web_page_preview: true,
				}),
			});
			const data = (await res.json()) as any;
			if (!res.ok || !data.ok) {
				return { ok: false, error: data.description || `HTTP ${res.status}` };
			}
			return { ok: true };
		} catch (err) {
			return { ok: false, error: (err as Error).message };
		}
	}

	async sendTest(token: string, chatId: string): Promise<{ ok: boolean; error?: string }> {
		const text = `🤖 <b>mnRouter Bot Linked Successfully!</b>\n\n` +
			`✅ <b>Status:</b> Online & Monitoring Active\n` +
			`🌐 <b>Host:</b> <code>https://mnrouter.mncuchiinhuttt.dev</code>\n` +
			`⏱ <b>Server Time:</b> ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}\n\n` +
			`<i>You will receive server notifications, provider cooldown alerts, and health metrics right here.</i>`;
		return this.sendMessage(text, token, chatId);
	}

	async notifyCooldown(provider: string, label: string, errorMsg: string): Promise<void> {
		const cfg = await this.getConfig();
		if (!cfg.enabled || !cfg.notifyCooldown) return;

		const now = Date.now();
		const last = this.lastCooldownAlerts.get(provider) ?? 0;
		if (now - last < 5 * 60 * 1000) return; // 5m debounce
		this.lastCooldownAlerts.set(provider, now);

		const text = `⚠️ <b>[mnRouter Alert] Provider Cooldown</b>\n\n` +
			`🔌 <b>Provider:</b> <code>${provider}</code>\n` +
			`🏷 <b>Connection:</b> <code>${label}</code>\n` +
			`❌ <b>Error:</b> <code>${errorMsg.slice(0, 200)}</code>\n` +
			`⏱ <b>Time:</b> ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}\n\n` +
			`<i>mnRouter is automatically failing over to healthy connections.</i>`;
		await this.sendMessage(text);
	}

	async notifyNewUser(email: string, packageName?: string | null): Promise<void> {
		const cfg = await this.getConfig();
		if (!cfg.enabled || !cfg.notifyNewUsers) return;

		const text = `👤 <b>[mnRouter] New User Registered</b>\n\n` +
			`📧 <b>Email:</b> <code>${email}</code>\n` +
			`📦 <b>Package:</b> ${packageName || "Default"}\n` +
			`⏱ <b>Time:</b> ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`;
		await this.sendMessage(text);
	}

	async getStatusSummary(): Promise<string> {
		const conns = await connectionService.listConnections();
		const activeCount = conns.filter((c) => c.status === "active" && c.isActive).length;
		const cooldownCount = conns.filter((c) => c.status === "cooldown").length;
		const uptimeHours = (process.uptime() / 3600).toFixed(1);

		return `📊 <b>[mnRouter Status]</b>\n\n` +
			`🟢 <b>Server:</b> Running (Uptime: ${uptimeHours}h)\n` +
			`🔌 <b>Active Connections:</b> ${activeCount} / ${conns.length}\n` +
			`🧊 <b>In Cooldown:</b> ${cooldownCount}\n` +
			`⏱ <b>Time:</b> ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`;
	}

	async getStatsSummary(): Promise<string> {
		const { totals } = await usageRepo.getSummary();
		const today = new Date().toISOString().slice(0, 10);
		return `📈 <b>[mnRouter Stats Today]</b>\n\n` +
			`📅 <b>Date:</b> <code>${today}</code>\n` +
			`🔢 <b>Total Requests:</b> ${totals.requests.toLocaleString()}\n` +
			`🪙 <b>Total Credits:</b> ${Number(totals.credits).toFixed(2)} cr\n` +
			`🔤 <b>Total Tokens:</b> ${(totals.promptTokens + totals.completionTokens).toLocaleString()}`;
	}

	async getCooldownsSummary(): Promise<string> {
		const conns = await connectionService.listConnections();
		const cooldowns = conns.filter((c) => c.status === "cooldown");
		if (cooldowns.length === 0) {
			return `✅ <b>No connections in cooldown!</b> All providers are healthy.`;
		}
		const list = cooldowns.map((c) => `• <b>${c.provider}</b> (${c.label}): <code>${c.lastError?.slice(0, 100) || "Unknown error"}</code>`).join("\n");
		return `🧊 <b>Connections in Cooldown (${cooldowns.length}):</b>\n\n${list}`;
	}

	async handleWebhookUpdate(body: any): Promise<void> {
		const message = body?.message;
		if (!message || !message.text) return;
		const chatId = String(message.chat?.id);
		const text = message.text.trim();

		if (text.startsWith("/start") || text.startsWith("/help")) {
			const reply = `🤖 <b>mnRouter Server Monitoring Bot</b>\n\n` +
				`Commands:\n` +
				`• <code>/status</code> — Live server health & connections\n` +
				`• <code>/stats</code> — System request count & credit usage\n` +
				`• <code>/cooldowns</code> — Check failed / cooldown connections\n` +
				`• <code>/chatid</code> — Show your Telegram Chat ID: <code>${chatId}</code>`;
			await this.sendMessage(reply, undefined, chatId);
		} else if (text.startsWith("/chatid")) {
			await this.sendMessage(`🆔 Your Telegram Chat ID is: <code>${chatId}</code>`, undefined, chatId);
		} else if (text.startsWith("/status")) {
			await this.sendMessage(await this.getStatusSummary(), undefined, chatId);
		} else if (text.startsWith("/stats")) {
			await this.sendMessage(await this.getStatsSummary(), undefined, chatId);
		} else if (text.startsWith("/cooldowns")) {
			await this.sendMessage(await this.getCooldownsSummary(), undefined, chatId);
		}
	}
}

export const telegramService = new TelegramService();
