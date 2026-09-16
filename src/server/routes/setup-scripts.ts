import { Hono } from "hono";
import { env } from "../env.js";
import { renderBashSetup, renderBashReset } from "./setup-templates-sh.js";
import { renderPowerShellSetup, renderPowerShellReset } from "./setup-templates-ps1.js";
import { modelRepo } from "../repositories/model.repository.js";
import { authService } from "../services/auth.service.js";
function getBaseUrl(c: { req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined; url: string } }): string {
	const queryBase = c.req.query("base")?.trim();
	if (queryBase) return queryBase.replace(/\/+$/, "");

	const proto = c.req.header("x-forwarded-proto") || "http";
	const host = c.req.header("host");
	if (host) return `${proto}://${host}`.replace(/\/+$/, "");

	try {
		const u = new URL(c.req.url);
		return `${u.protocol}//${u.host}`.replace(/\/+$/, "");
	} catch {
		return env.APP_URL.replace(/\/+$/, "");
	}
}

export function setupScriptRoutes() {
	const app = new Hono();

	// 1. macOS & Linux setup script
	const handleSetupSh = async (c: any) => {
		const baseUrl = getBaseUrl(c);
		const apiKey = c.req.query("key")?.trim() || "";
		const tool = c.req.query("tool")?.trim() || "";
		let modelsList: any[] = [];
		try {
			if (apiKey) {
				const auth = await authService.authenticateApiKey(apiKey);
				if (auth?.user && auth.user.allModels === false) {
					const userAllowedIds = await modelRepo.getUserModelIds(auth.user.id);
					const all = await modelRepo.listEnabled();
					modelsList = all.filter((m) => userAllowedIds.includes(m.id));
				}
			}
			if (!modelsList || modelsList.length === 0) {
				modelsList = await modelRepo.listEnabled();
			}
		} catch {}
		const script = renderBashSetup(baseUrl, apiKey, tool, modelsList);
		return c.text(script, 200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache, no-store, must-revalidate" });
	};
	app.get("/setup.sh", handleSetupSh);
	app.get("/api/setup.sh", handleSetupSh);

	// 2. macOS & Linux reset script
	const handleResetSh = (c: any) => {
		const tool = c.req.query("tool")?.trim() || "";
		const script = renderBashReset(tool);
		return c.text(script, 200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache, no-store, must-revalidate" });
	};
	app.get("/reset.sh", handleResetSh);
	app.get("/api/reset.sh", handleResetSh);

	// 3. Windows PowerShell setup script
	const handleSetupPs1 = async (c: any) => {
		const baseUrl = getBaseUrl(c);
		const apiKey = c.req.query("key")?.trim() || "";
		const tool = c.req.query("tool")?.trim() || "";
		let modelsList: any[] = [];
		try {
			if (apiKey) {
				const auth = await authService.authenticateApiKey(apiKey);
				if (auth?.user && auth.user.allModels === false) {
					const userAllowedIds = await modelRepo.getUserModelIds(auth.user.id);
					const all = await modelRepo.listEnabled();
					modelsList = all.filter((m) => userAllowedIds.includes(m.id));
				}
			}
			if (!modelsList || modelsList.length === 0) {
				modelsList = await modelRepo.listEnabled();
			}
		} catch {}
		const script = renderPowerShellSetup(baseUrl, apiKey, tool, modelsList);
		return c.text(script, 200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache, no-store, must-revalidate" });
	};
	app.get("/setup.ps1", handleSetupPs1);
	app.get("/api/setup.ps1", handleSetupPs1);

	// 4. Windows PowerShell reset script
	const handleResetPs1 = (c: any) => {
		const tool = c.req.query("tool")?.trim() || "";
		const script = renderPowerShellReset(tool);
		return c.text(script, 200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache, no-store, must-revalidate" });
	};
	app.get("/reset.ps1", handleResetPs1);
	app.get("/api/reset.ps1", handleResetPs1);

	// 5. MITM Root CA download
	app.get("/mitm/ca.crt", async (c) => {
		const { getOrCreateRootCA } = await import("../mitm/ca.js");
		const { crtPath } = getOrCreateRootCA();
		const cert = await Bun.file(crtPath).text();
		return c.text(cert, 200, { "content-type": "application/x-x509-ca-cert" });
	});

	// 6. One-line MITM setup script (macOS & Linux)
	app.get("/mitm-setup.sh", (c) => {
		const baseUrl = getBaseUrl(c);
		const apiKey = c.req.query("key")?.trim() || "";
		const script = `#!/usr/bin/env sh
set -e
printf "\\033[1;34m[mnRouter MITM]\\033[0m Setting up HTTPS Interception environment...\\n"

CA_DIR="$HOME/.mnrouter/mitm"
mkdir -p "$CA_DIR"
curl -fsSL "${baseUrl}/mitm/ca.crt" -o "$CA_DIR/rootCA.crt"
printf "  \\033[32m✓\\033[0m Downloaded Root CA to %s/rootCA.crt\\n" "$CA_DIR"

if [ "$(uname)" = "Darwin" ]; then
  printf "\\033[1;33m[1/2]\\033[0m Installing Root CA to macOS Keychain (requires sudo)...\\n"
  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$CA_DIR/rootCA.crt" || true
else
  printf "\\033[1;33m[1/2]\\033[0m Installing Root CA to Linux trust store...\\n"
  sudo cp "$CA_DIR/rootCA.crt" /usr/local/share/ca-certificates/mnrouter-mitm.crt 2>/dev/null || true
  sudo update-ca-certificates 2>/dev/null || true
fi

printf "\\033[1;33m[2/2]\\033[0m Configuring /etc/hosts redirects for Antigravity, Copilot, and Kiro...\\n"
awk '/# >>> mnrouter mitm >>>/{f=1;next}/# <<< mnrouter mitm <<</{f=0;next}!f' /etc/hosts > /tmp/hosts.clean
cat << 'EOF' >> /tmp/hosts.clean
# >>> mnrouter mitm >>>
127.0.0.1 cloudcode-pa.googleapis.com
127.0.0.1 daily-cloudcode-pa.googleapis.com
127.0.0.1 api.individual.githubcopilot.com
127.0.0.1 api.githubcopilot.com
127.0.0.1 copilot-proxy.githubusercontent.com
127.0.0.1 runtime.us-east-1.kiro.dev
127.0.0.1 codewhisperer.us-east-1.amazonaws.com
127.0.0.1 q.us-east-1.amazonaws.com
# <<< mnrouter mitm <<<
EOF
sudo cp /tmp/hosts.clean /etc/hosts
rm -f /tmp/hosts.clean

if [ "$(uname)" = "Darwin" ]; then
  dscacheutil -flushcache && sudo killall -HUP mDNSResponder 2>/dev/null || true
fi

printf "\\033[1;32m[Done]\\033[0m MITM environment is ready!\\n"
printf "\\033[1;37mStart the proxy anytime with: \\033[36msudo bun run mitm start --key \\"%s\\"\\033[0m\\n" "${apiKey}"
`;
		return c.text(script, 200, { "content-type": "text/plain; charset=utf-8" });
	});

	// 7. One-line MITM teardown script (macOS & Linux)
	app.get("/mitm-teardown.sh", (c) => {
		const script = `#!/usr/bin/env sh
set -e
printf "\\033[1;34m[mnRouter MITM]\\033[0m Tearing down MITM redirects and certificates...\\n"
awk '/# >>> mnrouter mitm >>>/{f=1;next}/# <<< mnrouter mitm <<</{f=0;next}!f' /etc/hosts > /tmp/hosts.clean
sudo cp /tmp/hosts.clean /etc/hosts
rm -f /tmp/hosts.clean
if [ "$(uname)" = "Darwin" ]; then
  sudo security delete-certificate -c "mnRouter MITM Root CA" /Library/Keychains/System.keychain 2>/dev/null || true
  dscacheutil -flushcache && sudo killall -HUP mDNSResponder 2>/dev/null || true
else
  sudo rm -f /usr/local/share/ca-certificates/mnrouter-mitm.crt 2>/dev/null || true
  sudo update-ca-certificates 2>/dev/null || true
fi
printf "\\033[1;32m[Done]\\033[0m All MITM hosts redirects and Root CA removed!\\n"
`;
		return c.text(script, 200, { "content-type": "text/plain; charset=utf-8" });
	});

	return app;
}
