import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@db";
import { issues, issueImages, type Issue, type IssueImage, type NewIssue, type NewIssueImage } from "@db/schema";

export class IssueRepository {
	async createIssue(data: NewIssue): Promise<Issue> {
		const [created] = await db.insert(issues).values(data).returning();
		return created!;
	}

	async addImage(data: NewIssueImage): Promise<IssueImage> {
		const [img] = await db.insert(issueImages).values(data).returning();
		return img!;
	}

	async findById(id: string): Promise<Issue | null> {
		const [found] = await db.select().from(issues).where(eq(issues.id, id));
		return found ?? null;
	}

	async getImagesByIssueId(issueId: string): Promise<IssueImage[]> {
		return db.select().from(issueImages).where(eq(issueImages.issueId, issueId));
	}

	async getImageById(id: string): Promise<IssueImage | null> {
		const [found] = await db.select().from(issueImages).where(eq(issueImages.id, id));
		return found ?? null;
	}

	async listByUser(userId: string): Promise<(Issue & { images: IssueImage[] })[]> {
		const rows = await db
			.select()
			.from(issues)
			.where(eq(issues.userId, userId))
			.orderBy(desc(issues.createdAt))
			.limit(100);

		const result: (Issue & { images: IssueImage[] })[] = [];
		for (const row of rows) {
			const images = await this.getImagesByIssueId(row.id);
			result.push({ ...row, images });
		}
		return result;
	}

	async listAll(filter?: { status?: string; search?: string }): Promise<(Issue & { images: IssueImage[] })[]> {
		const conditions = [];
		if (filter?.status && filter.status !== "all") {
			conditions.push(eq(issues.status, filter.status as Issue["status"]));
		}
		if (filter?.search) {
			const q = `%${filter.search.trim().toLowerCase()}%`;
			conditions.push(
				sql`LOWER(${issues.title}) LIKE ${q} OR LOWER(${issues.description}) LIKE ${q} OR LOWER(COALESCE(${issues.userEmail}, '')) LIKE ${q} OR LOWER(${issues.tool}) LIKE ${q}`
			);
		}

		const rows = await db
			.select()
			.from(issues)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(issues.createdAt))
			.limit(200);

		const result: (Issue & { images: IssueImage[] })[] = [];
		for (const row of rows) {
			const images = await this.getImagesByIssueId(row.id);
			result.push({ ...row, images });
		}
		return result;
	}

	async getSummaryStats(): Promise<{ total: number; openCount: number; investigatingCount: number; resolvedCount: number }> {
		const [stats] = await db
			.select({
				total: sql<number>`COUNT(*)`,
				openCount: sql<number>`COALESCE(SUM(CASE WHEN ${issues.status} = 'open' THEN 1 ELSE 0 END), 0)`,
				investigatingCount: sql<number>`COALESCE(SUM(CASE WHEN ${issues.status} = 'investigating' THEN 1 ELSE 0 END), 0)`,
				resolvedCount: sql<number>`COALESCE(SUM(CASE WHEN ${issues.status} = 'resolved' THEN 1 ELSE 0 END), 0)`,
			})
			.from(issues);

		return {
			total: Number(stats?.total || 0),
			openCount: Number(stats?.openCount || 0),
			investigatingCount: Number(stats?.investigatingCount || 0),
			resolvedCount: Number(stats?.resolvedCount || 0),
		};
	}

	async updateStatus(id: string, status: "open" | "investigating" | "resolved", adminNote?: string): Promise<Issue | null> {
		const updates: Partial<Issue> = {
			status,
			updatedAt: new Date(),
		};
		if (adminNote !== undefined) {
			updates.adminNote = adminNote;
		}
		if (status === "resolved") {
			updates.resolvedAt = new Date();
		}

		const [updated] = await db.update(issues).set(updates).where(eq(issues.id, id)).returning();
		return updated ?? null;
	}

	async deleteImagesByIssueId(issueId: string): Promise<IssueImage[]> {
		const images = await this.getImagesByIssueId(issueId);
		await db.delete(issueImages).where(eq(issueImages.issueId, issueId));
		return images;
	}

	async deleteIssue(id: string): Promise<boolean> {
		const [deleted] = await db.delete(issues).where(eq(issues.id, id)).returning();
		return !!deleted;
	}
}

export const issueRepo = new IssueRepository();
