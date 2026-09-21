import { describe, expect, it } from "bun:test";
import { parseEnvironment } from "../../src/server/env.js";

describe("production security configuration", () => {
	it("rejects production without SESSION_SECRET", () => {
		const result = parseEnvironment({ NODE_ENV: "production" });
		expect(result.ok).toBe(false);
	});

	it("rejects production secrets shorter than 32 characters", () => {
		const result = parseEnvironment({ NODE_ENV: "production", SESSION_SECRET: "too-short" });
		expect(result.ok).toBe(false);
	});

	it("accepts a strong production session secret", () => {
		const result = parseEnvironment({ NODE_ENV: "production", SESSION_SECRET: "a".repeat(32) });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data.SESSION_SECRET).toHaveLength(32);
	});

	it("keeps the development fallback outside production", () => {
		const result = parseEnvironment({ NODE_ENV: "development" });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data.SESSION_SECRET).toBe("dev-secret-change-me");
	});
});
