import nodemailer from "nodemailer";
import { env, isProd } from "../env.js";
import { renderMagicLinkEmail, renderInvitationEmail, renderIssueResolvedEmail, type MagicLinkEmailProps, type InvitationEmailProps, type IssueResolvedEmailProps } from "./templates.js";

export { renderMagicLinkEmail, renderInvitationEmail, renderIssueResolvedEmail, type MagicLinkEmailProps, type InvitationEmailProps, type IssueResolvedEmailProps };

const transporter = nodemailer.createTransport({
	host: env.SMTP_HOST,
	port: env.SMTP_PORT,
	secure: env.SMTP_PORT === 465,
	auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
	tls: { rejectUnauthorized: true },
});

export async function verifySmtp(): Promise<boolean> {
	try {
		await transporter.verify();
		return true;
	} catch (err) {
		console.error("[mail] smtp verify failed:", (err as Error).message);
		return false;
	}
}

export async function sendMagicLink(to: string, url: string, expireMinutes = 15): Promise<void> {
	if (!isProd) {
		console.log(`[mail:dev] magic link for ${to}: ${url}`);
	}
	if (!env.SMTP_PASS) return;

	try {
		const { html, text, subject } = renderMagicLinkEmail({ url, email: to, expireMinutes });
		await transporter.sendMail({
			from: env.MAIL_FROM,
			to,
			subject,
			html,
			text,
		});
		console.log(`[mail] sent magic link email to ${to} via SMTP`);
	} catch (err) {
		console.error(`[mail] failed to send email to ${to}:`, (err as Error).message);
	}
}

export async function sendInvitation(to: string, url: string, packageName?: string): Promise<void> {
	if (!isProd) {
		console.log(`[mail:dev] invitation for ${to}: ${url}`);
	}
	if (!env.SMTP_PASS) return;

	try {
		const { html, text, subject } = renderInvitationEmail({ url, email: to, packageName });
		await transporter.sendMail({
			from: env.MAIL_FROM,
			to,
			subject,
			html,
			text,
		});
		console.log(`[mail] sent invitation email to ${to} via SMTP`);
	} catch (err) {
		console.error(`[mail] failed to send invitation to ${to}:`, (err as Error).message);
	}
}
export async function sendIssueResolvedNotification(to: string, issue: { id: string; title: string; tool: string; adminNote?: string | null }): Promise<void> {
	if (!isProd) {
		console.log(`[mail:dev] issue resolved notification for ${to}: ticket ${issue.id}`);
	}
	if (!env.SMTP_PASS) return;

	try {
		const { html, text, subject } = renderIssueResolvedEmail({
			email: to,
			issueId: issue.id,
			title: issue.title,
			tool: issue.tool,
			adminNote: issue.adminNote,
		});
		await transporter.sendMail({
			from: env.MAIL_FROM,
			to,
			subject,
			html,
			text,
		});
		console.log(`[mail] sent issue resolved notification to ${to} via SMTP`);
	} catch (err) {
		console.error(`[mail] failed to send issue resolved email to ${to}:`, (err as Error).message);
	}
}
