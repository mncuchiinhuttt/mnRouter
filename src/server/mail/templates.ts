/**
 * Clean, high-craft email templates for mnRouter.
 * Styled to match the mnRouter web product aesthetic (Space Grotesk + IBM Plex Mono,
 * dark navy #0B0B26, electric blue #2323e6, clean warm-paper container, crisp typography).
 * No em-dashes anywhere per design guidelines.
 */

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export interface MagicLinkEmailProps {
	url: string;
	email: string;
	expireMinutes?: number;
}

export interface InvitationEmailProps {
	url: string;
	email: string;
	packageName?: string | null;
	maxApiKeys?: number;
	weeklyCreditBudget?: number | null;
	expireDays?: number;
}

export interface IssueResolvedEmailProps {
	issueId: string;
	title: string;
	tool: string;
	adminNote?: string | null;
	email: string;
	resolvedAt?: Date | string | null;
}

export function renderMagicLinkEmail(props: MagicLinkEmailProps): { html: string; text: string; subject: string } {
	const safeUrl = escapeHtml(props.url);
	const safeEmail = escapeHtml(props.email);
	const expireMinutes = props.expireMinutes ?? 15;

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to mnRouter</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F4F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F4F4F2; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #FFFFFF; border: 1px solid #D9D9D3; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 16px rgba(11, 11, 38, 0.04);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0B0B26; padding: 22px 28px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #FFFFFF; width: 30px; height: 30px; border-radius: 6px; text-align: center; vertical-align: middle;">
                          <svg viewBox="0 0 32 32" width="20" height="20" style="vertical-align: middle;">
                            <path d="M7 23V9l4.5 8L16 9l4.5 8L25 9v14" stroke="#2323e6" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </td>
                        <td style="padding-left: 12px; font-family: 'IBM Plex Mono', monospace, Courier; font-size: 13px; font-weight: 700; letter-spacing: 0.16em; color: #FFFFFF;">
                          MN ROUTER
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 10px; letter-spacing: 0.14em; color: #8F8FB8; text-transform: uppercase;">
                    // AUTH
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 28px;">
              <div style="display: inline-block; font-family: 'IBM Plex Mono', monospace, Courier; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; color: #2323e6; background-color: #EEF0FF; border: 1px solid #D5DAFF; padding: 3px 8px; border-radius: 4px; margin-bottom: 14px;">
                SIGN-IN LINK
              </div>

              <h1 style="margin: 0 0 10px; font-size: 24px; font-weight: 600; letter-spacing: -0.02em; color: #0B0B26; line-height: 1.25;">
                Sign in to your account
              </h1>

              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.65; color: #55556B;">
                Click the button below to sign in to mnRouter as <b style="color: #0B0B26;">${safeEmail}</b>. This link is single-use and will expire in ${expireMinutes} minutes.
              </p>

              <!-- CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background-color: #2323e6; border-radius: 6px;">
                    <a href="${safeUrl}" target="_blank" style="display: inline-block; padding: 13px 30px; font-family: 'IBM Plex Mono', monospace, Courier; font-size: 12.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #FFFFFF; text-decoration: none; border-radius: 6px;">
                      Sign in to Gateway &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Link fallback -->
              <div style="background-color: #F9F9F8; border: 1px solid #E5E5DF; border-radius: 6px; padding: 12px 14px; margin: 0 0 20px;">
                <div style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em; color: #8F8FB8; margin-bottom: 6px;">
                  Direct link
                </div>
                <a href="${safeUrl}" style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 11px; line-height: 1.5; color: #2323e6; word-break: break-all; text-decoration: none;">
                  ${safeUrl}
                </a>
              </div>

              <!-- Security notice -->
              <p style="margin: 0; font-size: 12px; line-height: 1.55; color: #8F8FB8;">
                If you did not request this login link, you can safely ignore this email. No password or credentials were changed.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF9F7; border-top: 1px solid #EAEAE4; padding: 16px 28px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 11px; color: #8F8FB8;">
                    MNROUTER · mncuchiinhuttt.dev
                  </td>
                  <td align="right" style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 10.5px; color: #8F8FB8;">
                    INTERNAL AI GATEWAY
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

	const text = `Sign in to mnRouter (${safeEmail}):\n${props.url}\n\nThis single-use link expires in ${expireMinutes} minutes. If you did not request this, you can safely ignore this email.`;
	const subject = "mnRouter · Sign in to your account";

	return { html, text, subject };
}

export function renderInvitationEmail(props: InvitationEmailProps): { html: string; text: string; subject: string } {
	const safeUrl = escapeHtml(props.url);
	const safeEmail = escapeHtml(props.email);
	const packageName = props.packageName ? escapeHtml(props.packageName) : "Standard";
	const expireDays = props.expireDays ?? 7;
	const keysLabel = `${props.maxApiKeys ?? 1} key${(props.maxApiKeys ?? 1) > 1 ? "s" : ""}`;
	const creditsLabel = props.weeklyCreditBudget != null ? `${props.weeklyCreditBudget.toLocaleString("en-US")} cr / week` : "Unlimited";

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You have been invited to mnRouter</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F4F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F4F4F2; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #FFFFFF; border: 1px solid #D9D9D3; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 16px rgba(11, 11, 38, 0.04);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0B0B26; padding: 22px 28px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #FFFFFF; width: 30px; height: 30px; border-radius: 6px; text-align: center; vertical-align: middle;">
                          <svg viewBox="0 0 32 32" width="20" height="20" style="vertical-align: middle;">
                            <path d="M7 23V9l4.5 8L16 9l4.5 8L25 9v14" stroke="#2323e6" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </td>
                        <td style="padding-left: 12px; font-family: 'IBM Plex Mono', monospace, Courier; font-size: 13px; font-weight: 700; letter-spacing: 0.16em; color: #FFFFFF;">
                          MN ROUTER
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 10px; letter-spacing: 0.14em; color: #8F8FB8; text-transform: uppercase;">
                    // INVITATION
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 28px;">
              <div style="display: inline-block; font-family: 'IBM Plex Mono', monospace, Courier; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; color: #2323e6; background-color: #EEF0FF; border: 1px solid #D5DAFF; padding: 3px 8px; border-radius: 4px; margin-bottom: 14px;">
                ACCESS INVITATION
              </div>

              <h1 style="margin: 0 0 10px; font-size: 24px; font-weight: 600; letter-spacing: -0.02em; color: #0B0B26; line-height: 1.25;">
                You're invited to mnRouter
              </h1>

              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.65; color: #55556B;">
                An administrator has granted <b style="color: #0B0B26;">${safeEmail}</b> access to the internal AI Gateway. Accept this invitation to create your account and connect your coding tools.
              </p>

              <!-- Package Specs Strip -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; background-color: #F9F9F8; border: 1px solid #E5E5DF; border-radius: 6px; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #EAEAE4;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em; color: #8F8FB8;">Package</td>
                        <td align="right" style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 12px; font-weight: 600; color: #0B0B26;">${packageName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #EAEAE4;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em; color: #8F8FB8;">Weekly Budget</td>
                        <td align="right" style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 12px; font-weight: 600; color: #2323e6;">${creditsLabel}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em; color: #8F8FB8;">Max API Keys</td>
                        <td align="right" style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 12px; font-weight: 600; color: #0B0B26;">${keysLabel}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background-color: #2323e6; border-radius: 6px;">
                    <a href="${safeUrl}" target="_blank" style="display: inline-block; padding: 13px 30px; font-family: 'IBM Plex Mono', monospace, Courier; font-size: 12.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #FFFFFF; text-decoration: none; border-radius: 6px;">
                      Accept Invitation &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Link fallback -->
              <div style="background-color: #F9F9F8; border: 1px solid #E5E5DF; border-radius: 6px; padding: 12px 14px; margin: 0 0 20px;">
                <div style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.1em; color: #8F8FB8; margin-bottom: 6px;">
                  Direct link
                </div>
                <a href="${safeUrl}" style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 11px; line-height: 1.5; color: #2323e6; word-break: break-all; text-decoration: none;">
                  ${safeUrl}
                </a>
              </div>

              <p style="margin: 0; font-size: 12px; line-height: 1.55; color: #8F8FB8;">
                This invitation is single-use and expires in ${expireDays} days. Once accepted, your account will be activated immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF9F7; border-top: 1px solid #EAEAE4; padding: 16px 28px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 11px; color: #8F8FB8;">
                    MNROUTER · mncuchiinhuttt.dev
                  </td>
                  <td align="right" style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 10.5px; color: #8F8FB8;">
                    INTERNAL AI GATEWAY
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

	const text = `You're invited to mnRouter (${safeEmail})\nPackage: ${packageName}\nWeekly Budget: ${creditsLabel}\n\nAccept your invitation: ${props.url}\nExpires in ${expireDays} days.`;
	const subject = "mnRouter · You're invited to access the AI Gateway";

	return { html, text, subject };
}
export function renderIssueResolvedEmail(props: IssueResolvedEmailProps): { html: string; text: string; subject: string } {
	const safeId = escapeHtml(props.issueId.slice(0, 13));
	const safeTitle = escapeHtml(props.title);
	const safeTool = escapeHtml(props.tool);
	const safeNote = props.adminNote ? escapeHtml(props.adminNote) : "Sự cố đã được kiểm tra và xử lý thành công.";
	const issuesUrl = "https://mnrouter.mncuchiinhuttt.dev/issues";

	const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>mnRouter · Issue Resolved</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F4F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F4F4F2; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #FFFFFF; border: 1px solid #D9D9D3; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 16px rgba(11, 11, 38, 0.04);">
          <!-- Header -->
          <tr>
            <td style="background-color: #0B0B26; padding: 22px 28px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <table border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #FFFFFF; width: 30px; height: 30px; border-radius: 6px; text-align: center; vertical-align: middle;">
                          <svg viewBox="0 0 32 32" width="20" height="20" style="vertical-align: middle;">
                            <path d="M7 23V9l4.5 8L16 9l4.5 8L25 9v14" stroke="#2323e6" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </td>
                        <td style="padding-left: 12px; font-family: 'IBM Plex Mono', monospace, Courier; font-size: 13px; font-weight: 700; letter-spacing: 0.16em; color: #FFFFFF;">
                          MN ROUTER
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 10px; letter-spacing: 0.14em; color: #10b981; text-transform: uppercase;">
                    // RESOLVED
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 32px 28px;">
              <div style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #10b981; margin-bottom: 8px; font-weight: 600;">
                ✓ INCIDENT RESOLVED
              </div>
              <h1 style="margin: 0 0 16px; font-size: 22px; line-height: 1.3; font-weight: 700; color: #0B0B26;">
                Báo cáo sự cố của bạn đã được xử lý!
              </h1>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #55556B;">
                Đội ngũ quản trị viên đã xem xét và khắc phục sự cố được báo cáo. Bạn có thể tiếp tục sử dụng bình thường.
              </p>

              <!-- Incident Details Card -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #F8F8FA; border: 1px solid #E5E5DF; border-radius: 8px; margin: 0 0 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 11px; color: #8F8FB8; text-transform: uppercase; padding-bottom: 8px;">Ticket ID</td>
                        <td align="right" style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 11px; font-weight: 700; color: #0B0B26; padding-bottom: 8px;">${safeId}</td>
                      </tr>
                      <tr>
                        <td style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 11px; color: #8F8FB8; text-transform: uppercase; padding-bottom: 8px;">Tiêu đề</td>
                        <td align="right" style="font-size: 12px; font-weight: 600; color: #0B0B26; padding-bottom: 8px; max-width: 280px;">${safeTitle}</td>
                      </tr>
                      <tr>
                        <td style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 11px; color: #8F8FB8; text-transform: uppercase; padding-bottom: 8px;">Công cụ / Tool</td>
                        <td align="right" style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 11px; font-weight: 600; color: #2323e6; padding-bottom: 8px;">${safeTool}</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="border-top: 1px solid #EAEAE4; padding-top: 10px; margin-top: 4px;">
                          <div style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 10.5px; color: #8F8FB8; text-transform: uppercase; margin-bottom: 4px;">Phản hồi từ Admin:</div>
                          <div style="font-size: 13px; line-height: 1.5; color: #0B0B26; background: #FFFFFF; border: 1px solid #D9D9D3; border-radius: 6px; padding: 10px 12px;">
                            ${safeNote}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Action Button -->
              <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="background-color: #2323e6; border-radius: 6px;">
                    <a href="${issuesUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; font-family: 'IBM Plex Mono', monospace, Courier; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #FFFFFF; text-decoration: none; border-radius: 6px;">
                      Xem lại sự cố trên Portal &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; line-height: 1.55; color: #8F8FB8;">
                Toàn bộ ảnh chụp màn hình đính kèm của sự cố này đã được tự động xoá hoàn toàn khỏi ổ đĩa máy chủ nhằm bảo mật dữ liệu.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF9F7; border-top: 1px solid #EAEAE4; padding: 16px 28px;">
              <table width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 11px; color: #8F8FB8;">
                    MNROUTER · mncuchiinhuttt.dev
                  </td>
                  <td align="right" style="font-family: 'IBM Plex Mono', monospace, Courier; font-size: 10.5px; color: #8F8FB8;">
                    INCIDENT MANAGEMENT
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

	const text = `Báo cáo sự cố ${safeId} (${safeTitle}) đã được giải quyết!\n\nPhản hồi từ Admin: ${props.adminNote || "Sự cố đã được xử lý thành công."}\n\nXem tại: ${issuesUrl}`;
	const subject = `mnRouter · Sự cố [${safeId}] đã được giải quyết`;

	return { html, text, subject };
}
