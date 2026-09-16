import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { userRoutes } from "../../src/server/routes/user.js";
import { userRepo } from "../../src/server/repositories/user.repository.js";

describe("User onboarding route (/api/me/onboard)", () => {
	it("completes onboarding and sets onboardedAt", async () => {
		const testUser = await userRepo.create({
			email: `onboard-${Date.now()}@test.local`,
			role: "user",
		});

		const app = new Hono();
		app.use("*", async (c, next) => {
			c.set("user", testUser);
			await next();
		});
		app.route("/", userRoutes());

		const res = await app.request("/api/me/onboard", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				displayName: "Test Onboarding User",
				username: `test_user_${Date.now().toString().slice(-6)}`,
				department: "AI Infrastructure",
			}),
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.ok).toBe(true);
		expect(data.user.displayName).toBe("Test Onboarding User");
		expect(data.user.department).toBe("AI Infrastructure");
		expect(data.user.onboardedAt).toBeDefined();

		// Cleanup
		await userRepo.delete(testUser.id);
	});

	it("rejects invalid username format or empty displayName", async () => {
		const testUser = await userRepo.create({
			email: `invalid-${Date.now()}@test.local`,
			role: "user",
		});

		const app = new Hono();
		app.use("*", async (c, next) => {
			c.set("user", testUser);
			await next();
		});
		app.route("/", userRoutes());

		// Missing display name
		const res1 = await app.request("/api/me/onboard", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ displayName: "", username: "valid_name" }),
		});
		expect(res1.status).toBe(400);

		// Invalid username (symbols)
		const res2 = await app.request("/api/me/onboard", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ displayName: "Valid Name", username: "bad/name*#" }),
		});
		expect(res2.status).toBe(400);

		await userRepo.delete(testUser.id);
	});
});
