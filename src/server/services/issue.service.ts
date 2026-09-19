import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { issueRepo } from "../repositories/issue.repository.js";
import type { Issue, IssueImage } from "@db/schema";

export const MAX_ISSUE_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB per screenshot
const ALLOWED_MIME_TYPES: Record<string, true> = {
	"image/jpeg": true,
	"image/png": true,
	"image/webp": true,
	"image/gif": true,
};

const ISSUE_UPLOADS_DIR = path.resolve(process.cwd(), "data", "issue-images");

async function ensureDir(): Promise<void> {
	if (!existsSync(ISSUE_UPLOADS_DIR)) {
		await mkdir(ISSUE_UPLOADS_DIR, { recursive: true });
	}
}

export class IssueService {
	async createIssue(params: {
		userId?: string | null;
		userEmail?: string | null;
		tool: string;
		customTool?: string | null;
		title: string;
		description: string;
		model?: string | null;
		images?: Array<{ filename: string; mimeType: string; buffer: Uint8Array }>;
	}): Promise<Issue & { images: IssueImage[] }> {
		const issueId = crypto.randomUUID();
		const issue = await issueRepo.createIssue({
			id: issueId,
			userId: params.userId ?? null,
			userEmail: params.userEmail ?? null,
			tool: params.tool,
			customTool: params.customTool ?? null,
			title: params.title.trim().slice(0, 300),
			description: params.description.trim(),
			model: params.model ?? null,
			status: "open",
		});

		const savedImages: IssueImage[] = [];
		if (params.images && params.images.length > 0) {
			await ensureDir();
			for (const img of params.images) {
				if (!ALLOWED_MIME_TYPES[img.mimeType]) continue;
				if (img.buffer.byteLength > MAX_ISSUE_IMAGE_SIZE || img.buffer.byteLength === 0) continue;

				const imgId = crypto.randomUUID();
				const sanitized = img.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "screenshot.png";
				const diskFilename = `${issueId}_${imgId}_${sanitized}`;
				const storagePath = path.join(ISSUE_UPLOADS_DIR, diskFilename);

				await writeFile(storagePath, img.buffer);

				const saved = await issueRepo.addImage({
					id: imgId,
					issueId,
					filename: img.filename.slice(0, 200),
					mimeType: img.mimeType,
					sizeBytes: img.buffer.byteLength,
					storagePath,
				});
				savedImages.push(saved);
			}
		}

		return { ...issue, images: savedImages };
	}

	async getIssue(id: string): Promise<(Issue & { images: IssueImage[] }) | null> {
		const issue = await issueRepo.findById(id);
		if (!issue) return null;
		const images = await issueRepo.getImagesByIssueId(id);
		return { ...issue, images };
	}

	async listUserIssues(userId: string): Promise<(Issue & { images: IssueImage[] })[]> {
		return issueRepo.listByUser(userId);
	}

	async listAdminIssues(filter?: { status?: string; search?: string }): Promise<{
		issues: (Issue & { images: IssueImage[] })[];
		summary: { total: number; openCount: number; investigatingCount: number; resolvedCount: number };
	}> {
		const [list, summary] = await Promise.all([
			issueRepo.listAll(filter),
			issueRepo.getSummaryStats(),
		]);
		return { issues: list, summary };
	}

	async updateStatus(id: string, status: "open" | "investigating" | "resolved", adminNote?: string): Promise<Issue | null> {
		const updated = await issueRepo.updateStatus(id, status, adminNote);
		if (!updated) return null;

		// When marked resolved, delete all associated image files from disk and DB!
		if (status === "resolved") {
			await this.purgeIssueImages(id);
		}

		return updated;
	}

	async purgeIssueImages(issueId: string): Promise<number> {
		const images = await issueRepo.deleteImagesByIssueId(issueId);
		let purged = 0;
		for (const img of images) {
			try {
				if (existsSync(img.storagePath)) {
					await unlink(img.storagePath);
					purged++;
				}
			} catch {
				// ignore disk error
			}
		}
		return purged;
	}

	async deleteIssue(id: string): Promise<boolean> {
		await this.purgeIssueImages(id);
		return issueRepo.deleteIssue(id);
	}

	async readImageBuffer(imageId: string): Promise<{ image: IssueImage; buffer: Buffer } | null> {
		const image = await issueRepo.getImageById(imageId);
		if (!image) return null;
		try {
			const buffer = await readFile(image.storagePath);
			return { image, buffer };
		} catch {
			return null;
		}
	}
}

export const issueService = new IssueService();
