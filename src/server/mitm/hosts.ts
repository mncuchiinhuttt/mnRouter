import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const MITM_TARGET_DOMAINS = [
	// Antigravity (Google)
	"cloudcode-pa.googleapis.com",
	"daily-cloudcode-pa.googleapis.com",
	// GitHub Copilot (VSCode)
	"api.individual.githubcopilot.com",
	"api.githubcopilot.com",
	"copilot-proxy.githubusercontent.com",
	// Kiro (AWS)
	"runtime.us-east-1.kiro.dev",
	"codewhisperer.us-east-1.amazonaws.com",
	"q.us-east-1.amazonaws.com",
];

const HOSTS_FILE = process.platform === "win32"
	? `${process.env.SystemRoot || "C:\\Windows"}\\System32\\drivers\\etc\\hosts`
	: "/etc/hosts";

const START_TAG = "# >>> mnrouter mitm >>>";
const END_TAG = "# <<< mnrouter mitm <<<";

export function generateHostsBlock(): string {
	const lines = [START_TAG];
	for (const domain of MITM_TARGET_DOMAINS) {
		lines.push(`127.0.0.1 ${domain}`);
	}
	lines.push(END_TAG);
	return lines.join("\n");
}

export function isHostsRedirectActive(): boolean {
	if (!existsSync(HOSTS_FILE)) return false;
	try {
		const content = readFileSync(HOSTS_FILE, "utf8");
		return content.includes(START_TAG) && content.includes("cloudcode-pa.googleapis.com");
	} catch {
		return false;
	}
}

export function addHostsEntries(): void {
	if (!existsSync(HOSTS_FILE)) return;
	const content = readFileSync(HOSTS_FILE, "utf8");
	if (content.includes(START_TAG)) {
		removeHostsEntries();
	}
	const updated = `${content.trimEnd()}\n\n${generateHostsBlock()}\n`;
	writeFileSync(HOSTS_FILE, updated, "utf8");
	flushDnsCache();
}

export function removeHostsEntries(): void {
	if (!existsSync(HOSTS_FILE)) return;
	const content = readFileSync(HOSTS_FILE, "utf8");
	const regex = new RegExp(`${START_TAG}[\\s\\S]*?${END_TAG}\\n?`, "g");
	const cleaned = content.replace(regex, "").trimEnd() + "\n";
	writeFileSync(HOSTS_FILE, cleaned, "utf8");
	flushDnsCache();
}

export function flushDnsCache(): void {
	try {
		if (process.platform === "darwin") {
			execSync("dscacheutil -flushcache && killall -HUP mDNSResponder 2>/dev/null || true");
		} else if (process.platform === "win32") {
			execSync("ipconfig /flushdns", { stdio: "ignore" });
		} else {
			execSync("resolvectl flush-caches 2>/dev/null || true");
		}
	} catch {}
}
