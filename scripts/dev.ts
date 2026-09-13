/** Dev: chạy server (bun --watch) + vite dev song song bằng Bun.spawn. */
export {};

const procs: Bun.Subprocess[] = [
	Bun.spawn(["bun", "--watch", "src/server/index.ts"], { stdout: "inherit", stderr: "inherit" }),
	Bun.spawn(["bun", "--bun", "node_modules/vite/bin/vite.js"], { stdout: "inherit", stderr: "inherit" }),
];

const killAll = () => {
	for (const p of procs) p.kill();
	process.exit(0);
};
process.on("SIGINT", killAll);
process.on("SIGTERM", killAll);

await Promise.all(procs.map((p) => p.exited));
