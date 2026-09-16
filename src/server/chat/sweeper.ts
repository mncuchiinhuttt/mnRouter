import { unlink } from "node:fs/promises";
import { fileRepo } from "../repositories/file.repository.js";
import { chatRepo } from "../repositories/chat.repository.js";

let sweeperTimer: ReturnType<typeof setInterval> | null = null;

export async function sweepExpiredChatData(): Promise<{ filesCleaned: number; artifactsCleaned: number; sharesCleaned: number }> {
	const now = new Date();

	// 1. Clean expired files from disk and DB
	let filesCleaned = 0;
	try {
		const expiredFiles = await fileRepo.findExpired(now);
		for (const file of expiredFiles) {
			try {
				await unlink(file.storagePath);
			} catch {
				// file may already be removed or missing
			}
		}
		filesCleaned = await fileRepo.deleteExpired(now);
	} catch (err) {
		console.error("[sweeper] file sweep failed:", (err as Error).message);
	}

	// 2. Clean expired artifacts from DB
	let artifactsCleaned = 0;
	try {
		artifactsCleaned = await chatRepo.deleteExpiredArtifacts(now);
	} catch (err) {
		console.error("[sweeper] artifact sweep failed:", (err as Error).message);
	}
	// 3. Clean expired share links
	let sharesCleaned = 0;
	try {
		sharesCleaned = await chatRepo.deleteExpiredShares(now);
	} catch (err) {
		console.error("[sweeper] share sweep failed:", (err as Error).message);
	}

	if (filesCleaned > 0 || artifactsCleaned > 0 || sharesCleaned > 0) {
		console.log(`[sweeper] cleaned 24h expired data: ${filesCleaned} files, ${artifactsCleaned} artifacts, ${sharesCleaned} shares`);
	}
	return { filesCleaned, artifactsCleaned, sharesCleaned };
}
export function startChatSweeper(intervalMs = 15 * 60 * 1000): void {
	if (sweeperTimer) return;
	// Run an initial sweep on boot
	void sweepExpiredChatData();
	sweeperTimer = setInterval(() => void sweepExpiredChatData(), intervalMs);
	console.log(`[sweeper] 24h TTL cleanup sweeper started (every ${Math.round(intervalMs / 60000)}m)`);
}

export function stopChatSweeper(): void {
	if (sweeperTimer) {
		clearInterval(sweeperTimer);
		sweeperTimer = null;
	}
}
