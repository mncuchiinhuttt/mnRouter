import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
	root: path.resolve(__dirname, "web"),
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@web": path.resolve(__dirname, "web/src"),
			"@shared": path.resolve(__dirname, "src/shared"),
		},
	},
	server: {
		port: 5173,
		proxy: {
			"/api": "http://127.0.0.1:8787",
			"/v1": "http://127.0.0.1:8787",
		},
	},
	build: {
		outDir: path.resolve(__dirname, "web-dist"),
		emptyOutDir: true,
	},
});
