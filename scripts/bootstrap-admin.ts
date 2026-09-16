/**
 * Bootstrap admin đầu tiên: `bun run bootstrap admin@example.com`
 * Nếu DB chưa có user nào → tạo admin với email này.
 */
import "dotenv/config";
import { userRepo } from "../src/server/repositories/user.repository.js";

const email = process.argv[2] ?? process.env.ADMIN_EMAIL;
if (!email || !email.includes("@")) {
	console.error("Usage: bun run bootstrap <admin-email>");
	process.exit(1);
}

const count = await userRepo.countUsers();
if (count > 0) {
	const existing = await userRepo.findByEmail(email);
	if (existing) {
		console.log(`User ${email} đã tồn tại (role=${existing.role}).`);
		if (existing.role !== "admin") {
			await userRepo.update(existing.id, { role: "admin" });
			console.log("→ Đã nâng lên admin.");
		}
	} else {
		console.log(`DB đã có ${count} user. Không tạo mới. Dùng bun run bootstrap chỉ khi DB rỗng.`);
	}
} else {
	const admin = await userRepo.create({
		email: email.toLowerCase(),
		role: "admin",
		maxApiKeys: 10,
	});
	console.log(`✅ Đã tạo admin: ${admin.email} (id=${admin.id})`);
	console.log("→ Mở portal và login bằng magic link với email này.");
}
process.exit(0);
