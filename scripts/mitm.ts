import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { getOrCreateRootCA, getTrustCertCommand, getUntrustCertCommand, CA_CRT_PATH } from "../src/server/mitm/ca.js";
import { addHostsEntries, removeHostsEntries, isHostsRedirectActive } from "../src/server/mitm/hosts.js";
import { startMitmServer } from "../src/server/mitm/proxy-server.js";

const args = process.argv.slice(2);
const command = args[0] || "help";

function getKeyArg(): string {
	const idx = args.indexOf("--key");
	if (idx >= 0 && args[idx + 1]) return args[idx + 1]!;
	return process.env.MNROUTER_API_KEY || "";
}

function getPortArg(): number | undefined {
	const idx = args.indexOf("--port");
	if (idx >= 0 && args[idx + 1]) return Number(args[idx + 1]);
	return undefined;
}

const os = process.platform === "darwin" ? "mac" : process.platform === "win32" ? "win" : "linux";

switch (command) {
	case "setup": {
		console.log("\x1b[1;34m[mnRouter MITM]\x1b[0m Generating Root CA...");
		const { crtPath } = getOrCreateRootCA();
		console.log(`\x1b[1;32m✓\x1b[0m Root CA certificate ready at: ${crtPath}`);

		console.log("\x1b[1;34m[mnRouter MITM]\x1b[0m Installing Root CA to system trust store (requires sudo)...");
		try {
			execSync(getTrustCertCommand(os), { stdio: "inherit" });
			console.log("\x1b[1;32m✓\x1b[0m Root CA trusted by system.");
		} catch (e) {
			console.warn("\x1b[1;33m!\x1b[0m Could not install cert automatically without sudo. Run manually:");
			console.log(getTrustCertCommand(os));
		}

		console.log("\x1b[1;34m[mnRouter MITM]\x1b[0m Configuring domain redirects in hosts file...");
		try {
			addHostsEntries();
			console.log("\x1b[1;32m✓\x1b[0m Hosts entries added for Antigravity, Copilot, and Kiro.");
		} catch (e) {
			console.warn("\x1b[1;33m!\x1b[0m Could not edit hosts file directly. Please run with sudo.");
		}

		console.log("\n\x1b[1;32m[Done]\x1b[0m MITM environment setup completed. Run: \x1b[1;36msudo bun scripts/mitm.ts start\x1b[0m");
		break;
	}

	case "teardown": {
		console.log("\x1b[1;34m[mnRouter MITM]\x1b[0m Cleaning up hosts file entries...");
		try {
			removeHostsEntries();
			console.log("\x1b[1;32m✓\x1b[0m Hosts entries removed.");
		} catch (e) {
			console.warn("\x1b[1;33m!\x1b[0m Could not remove hosts entries. Run with sudo.");
		}

		console.log("\x1b[1;34m[mnRouter MITM]\x1b[0m Removing Root CA from system trust store...");
		try {
			execSync(getUntrustCertCommand(os), { stdio: "inherit" });
			console.log("\x1b[1;32m✓\x1b[0m Root CA untrusted.");
		} catch (e) {
			console.warn("\x1b[1;33m!\x1b[0m Could not remove certificate. Run manually:");
			console.log(getUntrustCertCommand(os));
		}

		console.log("\n\x1b[1;32m[Done]\x1b[0m MITM environment reset completed.");
		break;
	}

	case "status": {
		console.log("=== mnRouter MITM Status ===");
		console.log("Root CA exists:", existsSync(CA_CRT_PATH));
		console.log("Hosts redirection active:", isHostsRedirectActive());
		break;
	}

	case "start": {
		const apiKey = getKeyArg();
		const port = getPortArg();
		getOrCreateRootCA();
		startMitmServer({ apiKey, port });
		break;
	}

	default: {
		console.log(`mnRouter MITM Proxy CLI
Usage:
  bun scripts/mitm.ts setup [--key <api_key>]    # Setup CA & /etc/hosts
  bun scripts/mitm.ts start [--port <443|8443>]  # Start HTTPS MITM Proxy
  bun scripts/mitm.ts teardown                   # Clean up CA & /etc/hosts
  bun scripts/mitm.ts status                     # Check setup status
`);
		break;
	}
}
