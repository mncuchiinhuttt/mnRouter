import nodemailer from "nodemailer";
import { env, isProd } from "../env.js";

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

export async function sendMagicLink(to: string, url: string): Promise<void> {
	if (!isProd && !env.SMTP_PASS) {
		console.log(`[mail:dev] magic link for ${to}: ${url}`);
		return;
	}
	const html = `<!doctype html>
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;line-height:1.6;">
  <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="background:#0b0b26;padding:20px 28px;">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;letter-spacing:.2em;color:#7d7dff;">MN ROUTER</span>
    </div>
    <div style="padding:28px;">
      <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Đăng nhập MNRouter</h2>
      <p style="margin:0 0 20px;font-size:14px;">Bấm nút bên dưới để đăng nhập. Link chỉ dùng được <b>1 lần</b> và hết hạn sau <b>15 phút</b>.</p>
      <a href="${url}" style="display:inline-block;background:#2727f5;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:8px;">Đăng nhập</a>
      <p style="margin:20px 0 0;font-size:12px;color:#64748b;word-break:break-all;">Nếu nút không hoạt động, dán link này vào trình duyệt:<br>${url}</p>
    </div>
    <div style="padding:14px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
      Nếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này.<br>mncuchiinhuttt.dev
    </div>
  </div>
</div>`;
	await transporter.sendMail({
		from: env.MAIL_FROM,
		to,
		subject: "MNRouter · Magic link đăng nhập",
		html,
		text: `Đăng nhập MNRouter: ${url}\nLink hết hạn sau 15 phút, chỉ dùng 1 lần.`,
	});
}
