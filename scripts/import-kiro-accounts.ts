import "dotenv/config";
import { db } from "../src/server/db/index.js";
import { providerConnections } from "../src/server/db/schema.js";
import { connectionRepo } from "../src/server/repositories/model.repository.js";
import { eq } from "drizzle-orm";
import accounts from "./kiro-accounts.json";

console.log(`Starting import of ${accounts.length} Kiro accounts into Neon Postgres...`);

// Check existing kiro connections
const existing = await db.select().from(providerConnections).where(eq(providerConnections.provider, "kiro"));
const existingLabels = new Set(existing.map((e) => e.label));

let imported = 0;
for (const acc of accounts) {
    const label = acc.label;
    if (existingLabels.has(label)) {
        console.log(`- Skipping ${label} (already exists)`);
        continue;
    }

    const expiresAt = acc.expiresAt ? new Date(acc.expiresAt).getTime() : undefined;

    await connectionRepo.create({
        id: crypto.randomUUID(),
        provider: "kiro",
        label,
        authType: "oauth",
        priority: 50,
        isActive: true,
        status: "active",
        data: {
            accessToken: acc.accessToken,
            refreshToken: acc.refreshToken,
            expiresAt,
            email: acc.email,
            ssoOnly: true,
            ssoClientId: acc.clientId,
            ssoClientSecret: acc.clientSecret,
            ssoRegion: "us-east-1",
        },
    });
    console.log(`+ Imported Kiro account: ${label} (${acc.email})`);
    imported++;
}

console.log(`Done: Imported ${imported} new Kiro accounts.`);
process.exit(0);
