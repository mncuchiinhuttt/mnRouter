import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["test/**/*.test.ts"],
		environment: "node",
	},
	resolve: {
		alias: {
			"@shared": new URL("./src/shared", import.meta.url).pathname,
			"@server": new URL("./src/server", import.meta.url).pathname,
			"@web": new URL("./web/src", import.meta.url).pathname,
		},
	},
});
