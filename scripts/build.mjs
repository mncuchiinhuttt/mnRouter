#!/usr/bin/env node
// Build: esbuild server -> dist/server/index.js (packages external, prod install provides them)
//        vite build web -> web-dist/
import { build } from "esbuild";
import { spawnSync } from "node:child_process";

const server = await build({
	entryPoints: ["src/server/index.ts"],
	bundle: true,
	platform: "node",
	target: "node22",
	format: "esm",
	outfile: "dist/server/index.js",
	packages: "external",
	sourcemap: true,
	logLevel: "info",
	banner: {
		// allow postgres/nodemailer dynamic imports to resolve from bundled ESM
		js: `import { createRequire } from "node:module"; const require = createRequire(import.meta.url);`,
	},
});

if (server.errors.length) process.exit(1);

const web = spawnSync("npx", ["vite", "build"], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(web.status ?? 1);
