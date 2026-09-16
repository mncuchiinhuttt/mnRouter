import { and, desc, eq } from "drizzle-orm";
import { db } from "@db";
import { mcpServers, type McpServer, type NewMcpServer } from "@db/schema";

export class McpRepository {
	async listByUser(userId: string): Promise<McpServer[]> {
		return db
			.select()
			.from(mcpServers)
			.where(eq(mcpServers.userId, userId))
			.orderBy(desc(mcpServers.createdAt));
	}

	async findById(id: string, userId: string): Promise<McpServer | null> {
		const [server] = await db
			.select()
			.from(mcpServers)
			.where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)));
		return server ?? null;
	}

	async create(data: Omit<NewMcpServer, "id" | "createdAt" | "updatedAt">): Promise<McpServer> {
		const [created] = await db
			.insert(mcpServers)
			.values({
				...data,
				id: crypto.randomUUID(),
			})
			.returning();
		return created!;
	}

	async update(id: string, userId: string, data: Partial<McpServer>): Promise<McpServer | null> {
		const [updated] = await db
			.update(mcpServers)
			.set({
				...data,
				updatedAt: new Date(),
			})
			.where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)))
			.returning();
		return updated ?? null;
	}

	async delete(id: string, userId: string): Promise<boolean> {
		const [deleted] = await db
			.delete(mcpServers)
			.where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)))
			.returning();
		return !!deleted;
	}
}

export const mcpRepo = new McpRepository();
