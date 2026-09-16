import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@db";
import { customSkills, type CustomSkill, type NewCustomSkill } from "@db/schema";

export class CustomSkillRepository {
	async listByUser(userId: string): Promise<CustomSkill[]> {
		return db
			.select()
			.from(customSkills)
			.where(eq(customSkills.userId, userId))
			.orderBy(desc(customSkills.createdAt));
	}

	async findActiveByIds(userId: string, ids: string[]): Promise<CustomSkill[]> {
		if (!ids.length) return [];
		return db
			.select()
			.from(customSkills)
			.where(
				and(
					eq(customSkills.userId, userId),
					eq(customSkills.enabled, true),
					inArray(customSkills.id, ids),
				),
			);
	}

	async findById(id: string, userId: string): Promise<CustomSkill | null> {
		const [skill] = await db
			.select()
			.from(customSkills)
			.where(and(eq(customSkills.id, id), eq(customSkills.userId, userId)));
		return skill ?? null;
	}

	async create(data: Omit<NewCustomSkill, "id" | "createdAt" | "updatedAt">): Promise<CustomSkill> {
		const [created] = await db
			.insert(customSkills)
			.values({
				...data,
				id: crypto.randomUUID(),
			})
			.returning();
		return created!;
	}

	async update(id: string, userId: string, data: Partial<CustomSkill>): Promise<CustomSkill | null> {
		const [updated] = await db
			.update(customSkills)
			.set({
				...data,
				updatedAt: new Date(),
			})
			.where(and(eq(customSkills.id, id), eq(customSkills.userId, userId)))
			.returning();
		return updated ?? null;
	}

	async delete(id: string, userId: string): Promise<boolean> {
		const [deleted] = await db
			.delete(customSkills)
			.where(and(eq(customSkills.id, id), eq(customSkills.userId, userId)))
			.returning();
		return !!deleted;
	}
}

export const customSkillRepo = new CustomSkillRepository();
