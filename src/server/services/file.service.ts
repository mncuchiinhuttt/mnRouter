import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileRepo } from "../repositories/file.repository.js";
import type { ChatFile } from "@db/schema";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max
export const FILE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const UPLOADS_DIR = path.resolve(process.cwd(), "data", "uploads");

async function ensureUploadsDir(): Promise<void> {
	if (!existsSync(UPLOADS_DIR)) {
		await mkdir(UPLOADS_DIR, { recursive: true });
	}
}

export class FileService {
	async saveUpload(params: {
		userId: string;
		threadId?: string | null;
		filename: string;
		mimeType: string;
		buffer: Uint8Array;
	}): Promise<ChatFile> {
		if (params.buffer.byteLength > MAX_FILE_SIZE) {
			throw new Error("file_too_large");
		}
		if (params.buffer.byteLength === 0) {
			throw new Error("file_empty");
		}

		await ensureUploadsDir();

		const fileId = crypto.randomUUID();
		const sanitizedName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "file.dat";
		const diskFilename = `${fileId}_${sanitizedName}`;
		const storagePath = path.join(UPLOADS_DIR, diskFilename);

		await writeFile(storagePath, params.buffer);

		const expiresAt = new Date(Date.now() + FILE_TTL_MS);

		return fileRepo.createFile({
			id: fileId,
			userId: params.userId,
			threadId: params.threadId,
			filename: params.filename.slice(0, 200),
			mimeType: params.mimeType || "application/octet-stream",
			sizeBytes: params.buffer.byteLength,
			storagePath,
			expiresAt,
		});
	}

	async getFile(id: string, userId?: string): Promise<ChatFile | null> {
		const file = await fileRepo.findById(id);
		if (!file) return null;
		if (userId && file.userId !== userId) return null;
		return file;
	}

	async getFiles(ids: string[]): Promise<ChatFile[]> {
		return fileRepo.findByIds(ids);
	}

	async readFileBuffer(id: string, userId?: string): Promise<{ file: ChatFile; buffer: Buffer } | null> {
		const file = await this.getFile(id, userId);
		if (!file) return null;
		try {
			const buffer = await readFile(file.storagePath);
			return { file, buffer };
		} catch {
			return null;
		}
	}

	async deleteFile(id: string, userId?: string): Promise<boolean> {
		const file = await this.getFile(id, userId);
		if (!file) return false;
		try {
			await unlink(file.storagePath);
		} catch {
			// ignore if already deleted from disk
		}
		return fileRepo.delete(id, userId);
	}
}

export const fileService = new FileService();
