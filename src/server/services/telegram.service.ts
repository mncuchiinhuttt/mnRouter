import { settingsRepo } from "../repositories/settings.repository.js";
import { BOT_COMMANDS, handleTelegramCommand } from "./telegram-commands.js";
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

	async detectChatId(token: string): Promise<{ ok: boolean; chatId?: string; username?: string; name?: string; error?: string }> {
		const cleanToken = token.trim();
		if (!cleanToken) return { ok: false, error: "Bot Token is required." };

		try {
			const res = await fetch(`https://api.telegram.org/bot${cleanToken}/getUpdates?limit=10`);
			const data = (await res.json()) as any;
			if (!res.ok || !data.ok) {
				return { ok: false, error: data.description || `HTTP ${res.status}` };
			}
			const updates = data.result || [];
			for (let i = updates.length - 1; i >= 0; i--) {
				const msg = updates[i].message || updates[i].channel_post || updates[i].my_chat_member;
				const chat = msg?.chat || msg?.from;
				if (chat?.id) {
					return {
						ok: true,
						chatId: String(chat.id),
						username: chat.username,
						name: [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.title || chat.username,
					};
				}
			}
			return {
				ok: false,
				error: "No recent messages found. Please send /start or any message to your bot on Telegram first, then try again!",
			};
		} catch (err) {
			return { ok: false, error: (err as Error).message };
		}
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

	async notifyInvitationAccepted(email: string, packageName?: string | null): Promise<void> {
		const cfg = await this.getConfig();
		if (!cfg.enabled || !cfg.notifyNewUsers) return;

		const text = `🎉 <b>[mnRouter] Member Joined via Invitation</b>\n\n` +
			`👤 <b>Email:</b> <code>${email}</code>\n` +
			`📦 <b>Package:</b> ${packageName || "Default"}\n` +
			`⏱ <b>Time:</b> ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`;
		await this.sendMessage(text);
	}

	async notifyNewUser(email: string, packageName?: string | null): Promise<void> {
		return this.notifyInvitationAccepted(email, packageName);
	}

	async registerCommands(tokenOverride?: string): Promise<{ ok: boolean; error?: string }> {
		const cfg = await this.getConfig();
		const token = (tokenOverride || cfg.botToken)?.trim();
		if (!token) return { ok: false, error: "Bot Token is required." };

		try {
			const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ commands: BOT_COMMANDS }),
			});
			const data = (await res.json()) as any;
			return { ok: Boolean(data.ok), error: data.description };
		} catch (err) {
			return { ok: false, error: (err as Error).message };
		}
	}

	async handleWebhookUpdate(body: any): Promise<void> {
		const message = body?.message || body?.channel_post;
		if (!message || !message.text) return;

		const chatId = String(message.chat?.id);
		const text = message.text.trim();

		const reply = await handleTelegramCommand(text, chatId);
		await this.sendMessage(reply, undefined, chatId);
	}
}

export const telegramService = new TelegramService();
