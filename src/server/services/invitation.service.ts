import { hashToken, randomToken } from "../auth/crypto.js";
import { env } from "../env.js";
import { sendInvitation } from "../mail/index.js";
import { invitationRepo, sessionRepo } from "../repositories/invitation.repository.js";
import { userRepo } from "../repositories/user.repository.js";
import { modelRepo } from "../repositories/model.repository.js";
import { auditRepo } from "../repositories/usage.repository.js";
import type { User } from "@db/schema";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_TTL_MS = 15 * 24 * 60 * 60 * 1000;

export interface InvitationInput {
	email: string;
	packageName?: string | null;
	maxApiKeys: number;
	monthlyCreditBudget: number | null;
	allModels: boolean;
	allowedModels: string[];
}

export class InvitationService {
	async createInvitation(input: InvitationInput, invitedBy: string) {
		const email = input.email.toLowerCase().trim();
		const existingUser = await userRepo.findByEmail(email);
		if (existingUser) throw new Error("email_exists");

		const pending = await invitationRepo.findPendingByEmail(email);
		if (pending) throw new Error("invitation_pending");

		const validModels = await modelRepo.validateModelIds(input.allowedModels);
		if (!validModels) throw new Error("invalid_models");

		const token = randomToken(32);
		const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

		const row = await invitationRepo.create({
			email,
			tokenHash: hashToken(token),
			invitedBy,
			packageName: input.packageName?.trim() || null,
			maxApiKeys: input.maxApiKeys,
			monthlyCreditBudget: input.monthlyCreditBudget,
			allModels: input.allModels,
			allowedModels: validModels,
			expiresAt,
		});

		const url = `${env.APP_URL}/invite/accept?token=${token}`;
		try {
			await sendInvitation(email, url, input.packageName ?? undefined);
		} catch (err) {
			await invitationRepo.revoke(row.id);
			throw err;
		}

		await auditRepo.record(invitedBy, "invitation.create", row.id, { email, packageName: row.packageName });
		return { id: row.id, email, packageName: row.packageName, expiresAt };
	}

	async consumeInvitation(
		token: string,
		displayName?: string,
		ip?: string,
		userAgent?: string,
	): Promise<{ sessionToken: string; user: User } | null> {
		const tokenHash = hashToken(token);
		const invitation = await invitationRepo.findPendingByHash(tokenHash);
		if (!invitation) return null;

		const existing = await userRepo.findByEmail(invitation.email);
		if (existing) throw new Error("email_exists");

		const accepted = await invitationRepo.markAccepted(invitation.id);
		if (!accepted) return null;

		const user = await userRepo.create({
			email: invitation.email,
			displayName: displayName?.trim() || null,
			packageName: invitation.packageName,
			maxApiKeys: invitation.maxApiKeys,
			monthlyCreditBudget: invitation.monthlyCreditBudget,
			allModels: invitation.allModels,
		});

		if (!invitation.allModels && invitation.allowedModels.length > 0) {
			await modelRepo.setUserModels(user.id, invitation.allowedModels);
		}

		const sessionToken = randomToken(32);
		await sessionRepo.create({
			userId: user.id,
			tokenHash: hashToken(sessionToken),
			expiresAt: new Date(Date.now() + SESSION_TTL_MS),
			ip,
			userAgent,
		});

		return { sessionToken, user };
	}

	async revokeInvitation(id: string, actorUserId: string): Promise<boolean> {
		const success = await invitationRepo.revoke(id);
		if (success) {
			await auditRepo.record(actorUserId, "invitation.revoke", id);
		}
		return success;
	}

	async listInvitations(limit = 100) {
		return invitationRepo.listAll(limit);
	}
}

export const invitationService = new InvitationService();
