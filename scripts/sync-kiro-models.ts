import "dotenv/config";
import { db } from "../src/server/db/index.js";
import { models } from "../src/server/db/schema.js";
import { DEFAULT_MODELS } from "../src/server/gateway/models.js";
import { eq } from "drizzle-orm";

console.log("Updating Kiro models in Neon DB...");

// 1. Delete all old kiro models
await db.delete(models).where(eq(models.provider, "kiro"));
console.log("- Cleared old Kiro models");

// 2. Filter kiro models from DEFAULT_MODELS and insert them
const kiroModels = DEFAULT_MODELS.filter((m) => m.provider === "kiro");
await db.insert(models).values(
    kiroModels.map((m) => ({
        id: m.id,
        provider: m.provider,
        upstreamModel: m.upstreamModel,
        displayName: m.displayName,
        enabled: true,
        priority: m.priority,
        contextWindow: m.contextWindow,
        maxOutput: m.maxOutput,
        priceIn: m.priceIn,
        priceOut: m.priceOut,
        priceCacheRead: m.priceCacheRead,
        priceCacheWrite: m.priceCacheWrite,
    }))
);

console.log(`+ Successfully inserted ${kiroModels.length} Kiro models into DB:`);
for (const m of kiroModels) {
    console.log(`  - [${m.id}] ${m.displayName} (upstream: ${m.upstreamModel})`);
}

process.exit(0);
