import { eq } from "drizzle-orm";
import { db } from "@db";
import { settings } from "@db/schema";

export class SettingsRepository {
	async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
		const [row] = await db.select().from(settings).where(eq(settings.key, key));
		return (row?.value as T) ?? defaultValue;
	}

	async set(key: string, value: unknown): Promise<void> {
		await db
			.insert(settings)
			.values({ key, value, updatedAt: new Date() })
			.onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
	}
}

export const settingsRepo = new SettingsRepository();
