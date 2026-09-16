import { authService, SESSION_COOKIE } from "../services/auth.service.js";
import { invitationService, type InvitationInput } from "../services/invitation.service.js";

export { SESSION_COOKIE, type InvitationInput };

export class InvitationError extends Error {
	constructor(readonly code: "email_exists") {
		super(code);
		this.name = "InvitationError";
	}
}

export async function createMagicLink(email: string, ip?: string, userAgent?: string) {
	return authService.createMagicLink(email, ip, userAgent);
}

export async function consumeMagicLink(token: string, ip?: string, userAgent?: string) {
	return authService.consumeMagicLink(token, ip, userAgent);
}


export async function destroySession(token: string) {
	return authService.logout(token);
}
export async function getSessionUser(token: string) {
	return authService.authenticateSession(token);
}

export async function createInvitation(input: InvitationInput, invitedBy: string) {
	return invitationService.createInvitation(input, invitedBy);
}

export async function consumeInvitation(token: string, displayName?: string, ip?: string, userAgent?: string) {
	return invitationService.consumeInvitation(token, displayName, ip, userAgent);
}
