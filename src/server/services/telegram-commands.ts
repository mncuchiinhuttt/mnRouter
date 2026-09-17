import { userService } from "./user.service.js";
import { invitationService } from "./invitation.service.js";
import { connectionService } from "./connection.service.js";
import { announcementService } from "./announcement.service.js";
import { usageRepo } from "../repositories/usage.repository.js";
import { env } from "../env.js";

export const BOT_COMMANDS = [
	{ command: "status", description: "Live server health, uptime & connections" },
	{ command: "usage", description: "Today's request count & credits usage" },
	{ command: "quotas", description: "Provider connection quotas & health" },
	{ command: "logs", description: "Latest 5 API request logs" },
	{ command: "users", description: "List users & weekly budgets" },
	{ command: "invite", description: "Invite user: /invite email [pkg] [credits]" },
	{ command: "invitations", description: "List pending invitations" },
	{ command: "announce", description: "Post dashboard banner: /announce text" },
	{ command: "cooldowns", description: "Check failed connections" },
	{ command: "help", description: "List all commands & syntax" },
];

export async function handleTelegramCommand(text: string, chatId: string): Promise<string> {
	const trimmed = text.trim();
	const parts = trimmed.split(/\s+/);
	const cmd = parts[0]?.toLowerCase().replace(/@\w+$/, "") || ""; // strip @botname if in group

	switch (cmd) {
		case "/start":
		case "/help":
			return getHelpText(chatId);

		case "/chatid":
			return `🆔 Your Telegram Chat ID is: <code>${chatId}</code>`;

		case "/status":
			return getStatusText();

		case "/usage":
		case "/stats":
			return getStatsText();

		case "/quotas":
		case "/quota":
			return getQuotasText();

		case "/cooldowns":
		case "/cooldown":
			return getCooldownsText();

		case "/logs":
		case "/log":
			return getLogsText();

		case "/users":
		case "/user":
			return getUsersText();

		case "/invitations":
		case "/invites":
			return getInvitationsText();

		case "/invite":
			return handleInvite(parts.slice(1));

		case "/announce":
		case "/broadcast":
			return handleAnnounce(parts.slice(1).join(" "));

		default:
			return `❓ Unknown command: <code>${cmd}</code>\n\nType /help to see all available commands.`;
	}
}

function getHelpText(chatId: string): string {
	return `🤖 <b>mnRouter Management & Monitoring Bot</b>\n\n` +
		`<b>System Commands:</b>\n` +
		`• <code>/status</code> — Live server health & uptime\n` +
		`• <code>/usage</code> — Today's requests, tokens & credits\n` +
		`• <code>/quotas</code> — Provider connection health & quotas\n` +
		`• <code>/cooldowns</code> — Check failed/cooldown connections\n` +
		`• <code>/logs</code> — View latest 5 API request logs\n\n` +
		`<b>User & Access Management:</b>\n` +
		`• <code>/users</code> — List all active users & budgets\n` +
		`• <code>/invitations</code> — List pending invitations\n` +
		`• <code>/invite email [package] [credits]</code> — Create & send invite\n` +
		`  <i>Example:</i> <code>/invite friend@gmail.com Pro 50000</code>\n` +
		`• <code>/announce &lt;message&gt;</code> — Post dashboard banner\n` +
		`• <code>/chatid</code> — Show your Chat ID (<code>${chatId}</code>)`;
}

async function getStatusText(): Promise<string> {
	const conns = await connectionService.listConnections();
	const activeCount = conns.filter((c) => c.status === "active" && c.isActive).length;
	const cooldownCount = conns.filter((c) => c.status === "cooldown").length;
	const uptimeHours = (process.uptime() / 3600).toFixed(1);

	return `📊 <b>[mnRouter System Status]</b>\n\n` +
		`🟢 <b>Server:</b> Online (Uptime: ${uptimeHours} hours)\n` +
		`🔌 <b>Active Connections:</b> ${activeCount} / ${conns.length}\n` +
		`🧊 <b>In Cooldown:</b> ${cooldownCount}\n` +
		`🌐 <b>Host:</b> <code>${env.APP_URL}</code>\n` +
		`⏱ <b>Server Time:</b> ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`;
}

async function getStatsText(): Promise<string> {
	const { totals } = await usageRepo.getSummary();
	const today = new Date().toISOString().slice(0, 10);
	return `📈 <b>[mnRouter Today's Usage]</b>\n\n` +
		`📅 <b>Date:</b> <code>${today}</code>\n` +
		`🔢 <b>Total Requests:</b> ${totals.requests.toLocaleString()}\n` +
		`🪙 <b>Credits Consumed:</b> ${Number(totals.credits).toFixed(2)} cr\n` +
		`🔤 <b>Total Tokens:</b> ${(totals.promptTokens + totals.completionTokens).toLocaleString()}\n` +
		`  • Input: ${totals.promptTokens.toLocaleString()}\n` +
		`  • Output: ${totals.completionTokens.toLocaleString()}`;
}

async function getQuotasText(): Promise<string> {
	const conns = await connectionService.listConnections();
	const byProvider = new Map<string, { total: number; active: number; cooldown: number }>();

	for (const c of conns) {
		const stat = byProvider.get(c.provider) || { total: 0, active: 0, cooldown: 0 };
		stat.total++;
		if (c.status === "active" && c.isActive) stat.active++;
		if (c.status === "cooldown") stat.cooldown++;
		byProvider.set(c.provider, stat);
	}

	const lines = Array.from(byProvider.entries()).map(([prov, s]) => {
		const icon = s.cooldown > 0 ? "⚠️" : "🟢";
		return `${icon} <b>${prov}</b>: ${s.active}/${s.total} active` + (s.cooldown > 0 ? ` (🧊 ${s.cooldown} cooldown)` : "");
	});

	return `📊 <b>[Provider Connections Health]</b>\n\n${lines.join("\n")}\n\n<i>Type /cooldowns for error details.</i>`;
}

async function getCooldownsText(): Promise<string> {
	const conns = await connectionService.listConnections();
	const cooldowns = conns.filter((c) => c.status === "cooldown");
	if (cooldowns.length === 0) {
		return `✅ <b>No connections in cooldown!</b> All providers are running smoothly.`;
	}
	const list = cooldowns.map((c) => `• <b>${c.provider}</b> (<code>${c.label}</code>):\n  ❌ <i>${c.lastError?.slice(0, 120) || "Cooldown"}</i>`).join("\n\n");
	return `🧊 <b>Connections in Cooldown (${cooldowns.length}):</b>\n\n${list}`;
}

async function getLogsText(): Promise<string> {
	const res = await usageRepo.getAllLogsPaged(1, 5);
	if (!res.logs || res.logs.length === 0) {
		return `📋 No request logs found yet.`;
	}

	const rows = res.logs.map((l) => {
		const icon = l.status === "ok" ? "🟢" : "🔴";
		const time = new Date(l.ts).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
		const lat = l.latencyMs ? `${(l.latencyMs / 1000).toFixed(1)}s` : "—";
		return `${icon} <b>${l.model}</b> (${l.provider})\n` +
			`  User: <code>${l.userEmail || "anonymous"}</code> · Time: ${time}\n` +
			`  Tokens: ${l.promptTokens} in / ${l.completionTokens} out · Cost: ${Number(l.credits).toFixed(4)} cr · Latency: ${lat}`;
	});

	return `📋 <b>Latest 5 Request Logs:</b>\n\n${rows.join("\n\n")}`;
}

async function getUsersText(): Promise<string> {
	const users = await userService.listAllUsers();
	if (users.length === 0) return `👥 No users found in database.`;

	const rows = users.slice(0, 15).map((u) => {
		const roleBadge = u.role === "admin" ? " [ADMIN]" : "";
		const budget = (u.weeklyCreditBudget ?? u.monthlyCreditBudget) ? `${(u.weeklyCreditBudget ?? u.monthlyCreditBudget)!.toLocaleString()} cr/w` : "Unlimited";
		return `• <b>${u.email}</b>${roleBadge}\n` +
			`  Package: ${u.packageName || "Default"} · Keys: ${u.activeKeys} · Weekly Budget: ${budget} · Spent: ${u.totalCredits.toFixed(2)} cr`;
	});

	const suffix = users.length > 15 ? `\n\n<i>...and ${users.length - 15} more users.</i>` : "";
	return `👥 <b>Active Users (${users.length}):</b>\n\n${rows.join("\n\n")}${suffix}`;
}

async function getInvitationsText(): Promise<string> {
	const all = await invitationService.listInvitations(20);
	const pending = all.filter((i) => i.status === "pending" && new Date(i.expiresAt) > new Date());
	if (pending.length === 0) {
		return `✉️ <b>No pending invitations.</b> Use <code>/invite email</code> to invite someone!`;
	}

	const rows = pending.map((inv) => {
		const exp = new Date(inv.expiresAt).toLocaleDateString("vi-VN");
		const budget = inv.weeklyCreditBudget ? `${inv.weeklyCreditBudget.toLocaleString()} cr/w` : "Unlimited";
		return `• <b>${inv.email}</b> (${inv.packageName || "Default"})\n` +
			`  Budget: ${budget} · Expires: ${exp}\n` +
			`  🔗 <code>${env.APP_URL}/invite/accept?token=${inv.tokenHash}</code>`;
	});

	return `✉️ <b>Pending Invitations (${pending.length}):</b>\n\n${rows.join("\n\n")}`;
}

async function handleInvite(args: string[]): Promise<string> {
	const email = args[0]?.trim();
	if (!email || !email.includes("@")) {
		return `⚠️ <b>Syntax:</b> <code>/invite &lt;email&gt; [packageName] [weeklyCreditBudget]</code>\n\n` +
			`<i>Example:</i> <code>/invite friend@gmail.com Pro 50000</code>`;
	}

	const packageName = args[1]?.trim() || "Default";
	const weeklyCreditBudget = args[2] ? Number(args[2].replace(/\D/g, "")) : 50000;

	try {
		const res = await invitationService.createInvitation(
			{
				email,
				packageName,
				maxApiKeys: 1,
				weeklyCreditBudget,
				allModels: true,
				allowedModels: [],
			},
			"telegram_bot",
		);

		return `✉️ <b>Invitation Created Successfully!</b>\n\n` +
			`👤 <b>Email:</b> <code>${email}</code>\n` +
			`📦 <b>Package:</b> ${packageName}\n` +
			`🪙 <b>Weekly Budget:</b> ${weeklyCreditBudget.toLocaleString()} credits\n\n` +
			`🔗 <b>Direct Accept Link:</b>\n<code>${res.inviteUrl}</code>\n\n` +
			`<i>(If email was configured, an invitation email has also been sent automatically).</i>`;
	} catch (err) {
		const msg = (err as Error).message;
		if (msg === "email_exists") return `❌ Error: User with email <code>${email}</code> already exists!`;
		if (msg === "invitation_pending") return `⚠️ Warning: A pending invitation for <code>${email}</code> already exists! Type /invitations to view it.`;
		return `❌ Failed to create invitation: ${msg}`;
	}
}

async function handleAnnounce(content: string): Promise<string> {
	const trimmed = content.trim();
	if (!trimmed) {
		return `⚠️ <b>Syntax:</b> <code>/announce &lt;your message&gt;</code>\n\n` +
			`<i>Example:</i> <code>/announce Server maintenance tonight from 2AM to 3AM</code>`;
	}

	try {
		const item = await announcementService.createAnnouncement(
			{
				title: "Thông báo từ Quản trị viên",
				content: trimmed,
				type: "info",
				active: true,
			},
			"telegram_bot",
		);

		return `📢 <b>Announcement Broadcasted to Dashboard!</b>\n\n` +
			`ID: <code>${item.id}</code>\n` +
			`Message: <i>${trimmed}</i>\n\n` +
			`<i>All users on the mnRouter web app will see this banner immediately.</i>`;
	} catch (err) {
		return `❌ Failed to post announcement: ${(err as Error).message}`;
	}
}
