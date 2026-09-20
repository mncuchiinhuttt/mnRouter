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
		const requestedModel = c.req.query("model")?.trim() || "";
		const exploreModel = c.req.query("explore_model")?.trim() || "";
		const planModel = c.req.query("plan_model")?.trim() || "";
		const subagentModels = { explore: exploreModel, plan: planModel };
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
		const script = renderBashSetup(baseUrl, apiKey, tool, modelsList, requestedModel, subagentModels);
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
		const requestedModel = c.req.query("model")?.trim() || "";
		const exploreModel = c.req.query("explore_model")?.trim() || "";
		const planModel = c.req.query("plan_model")?.trim() || "";
		const subagentModels = { explore: exploreModel, plan: planModel };
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
		const script = renderPowerShellSetup(baseUrl, apiKey, tool, modelsList, requestedModel, subagentModels);
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
	// 4b. One-Click Harness Doctor CLI script (macOS & Linux)
	app.get("/doctor.sh", (c) => {
		const baseUrl = getBaseUrl(c);
		const apiKey = c.req.query("key")?.trim() || "";
		const script = `#!/usr/bin/env sh
set -e
printf "\\033[1;34m[mnRouter Doctor]\\033[0m Starting environment diagnostics...\\n"
BASE="${baseUrl}"
KEY="${apiKey}"

if [ -z "$KEY" ]; then
  printf "  \\033[1;33m!\\033[0m No API Key supplied via URL parameter. Checking environment variables...\\n"
  KEY="$MNROUTER_API_KEY"
  if [ -z "$KEY" ]; then KEY="$OMP_API_KEY"; fi
  if [ -z "$KEY" ]; then KEY="$OPENAI_API_KEY"; fi
fi

# 1. Gateway Connectivity
printf "\\033[1;37m[1/4] Checking gateway connectivity...\\033[0m\\n"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/healthz" || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  printf "  \\033[32m✓\\033[0m Gateway is online & reachable (%s)\\n" "$BASE"
else
  printf "  \\033[31m✗\\033[0m Cannot reach gateway at %s (HTTP %s)\\n" "$BASE" "$HTTP_STATUS"
fi

# 2. Authentication Test
printf "\\033[1;37m[2/4] Testing API authentication...\\033[0m\\n"
if [ -n "$KEY" ]; then
  AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $KEY" "$BASE/v1/models" || echo "000")
  if [ "$AUTH_STATUS" = "200" ]; then
    printf "  \\033[32m✓\\033[0m API Key authenticated successfully\\n"
  else
    printf "  \\033[31m✗\\033[0m API Key authentication failed (HTTP %s)\\n" "$AUTH_STATUS"
  fi
else
  printf "  \\033[33m!\\033[0m Skipping auth test (no API Key found)\\n"
fi

# 3. Environment Variables Check
printf "\\033[1;37m[3/4] Inspecting local CLI environment variables...\\033[0m\\n"
check_var() {
  var_name="$1"
  eval "val=\\$$var_name"
  if [ -n "$val" ]; then
    printf "  • %-20s = %s\\n" "$var_name" "$val"
  fi
}
check_var "OMP_BASE_URL"
check_var "ANTHROPIC_BASE_URL"
check_var "OPENAI_BASE_URL"
check_var "OPENCODE_BASE_URL"
check_var "PI_API_BASE"
check_var "HERMES_API_BASE"
check_var "DEEPSEEK_BASE_URL"

# 4. Latency Benchmark
printf "\\033[1;37m[4/4] Measuring network round-trip latency...\\033[0m\\n"
LATENCY=$(curl -o /dev/null -s -w "%{time_total}s\\n" "$BASE/healthz")
printf "  \\033[32m✓\\033[0m Round-trip latency: %s\\n" "$LATENCY"

printf "\\033[1;32m[mnRouter Doctor] Diagnostics complete!\\033[0m\\n"
`;
		return c.text(script, 200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache, no-store, must-revalidate" });
	});

	// 4c. One-Click Harness Doctor CLI script (Windows PowerShell)
	app.get("/doctor.ps1", (c) => {
		const baseUrl = getBaseUrl(c);
		const apiKey = c.req.query("key")?.trim() || "";
		const script = `$ErrorActionPreference = "Continue"
Write-Host "[mnRouter Doctor] Starting Windows environment diagnostics..." -ForegroundColor Cyan
$base = "${baseUrl}"
$key = "${apiKey}"

if (-not $key) {
    if ($env:MNROUTER_API_KEY) { $key = $env:MNROUTER_API_KEY }
    elseif ($env:OMP_API_KEY) { $key = $env:OMP_API_KEY }
    elseif ($env:OPENAI_API_KEY) { $key = $env:OPENAI_API_KEY }
}

# 1. Gateway Connectivity
Write-Host "[1/4] Checking gateway connectivity..." -ForegroundColor White
try {
    $res = Invoke-WebRequest -Uri "$base/healthz" -UseBasicParsing -TimeoutSec 5
    if ($res.StatusCode -eq 200) {
        Write-Host "  ✓ Gateway is online & reachable ($base)" -ForegroundColor Green
    }
} catch {
    Write-Host "  ✗ Cannot reach gateway: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Authentication Test
Write-Host "[2/4] Testing API authentication..." -ForegroundColor White
if ($key) {
    try {
        $headers = @{ "Authorization" = "Bearer $key" }
        $authRes = Invoke-RestMethod -Uri "$base/v1/models" -Headers $headers -UseBasicParsing -TimeoutSec 5
        if ($authRes.data) {
            Write-Host "  ✓ API Key authenticated successfully ($($authRes.data.Count) models available)" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ✗ Authentication failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "  ! Skipping auth test (no API Key found)" -ForegroundColor Yellow
}

# 3. Environment Variables Check
Write-Host "[3/4] Inspecting local CLI environment variables..." -ForegroundColor White
$vars = @("OMP_BASE_URL", "ANTHROPIC_BASE_URL", "OPENAI_BASE_URL", "OPENCODE_BASE_URL", "PI_API_BASE", "HERMES_API_BASE")
foreach ($v in $vars) {
    $val = [System.Environment]::GetEnvironmentVariable($v, [System.EnvironmentVariableTarget]::User)
    if (-not $val) { $val = [System.Environment]::GetEnvironmentVariable($v, [System.EnvironmentVariableTarget]::Process) }
    if ($val) { Write-Host "  • $v = $val" -ForegroundColor Gray }
}

Write-Host "[Done] Diagnostics complete!" -ForegroundColor Green
`;
		return c.text(script, 200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache, no-store, must-revalidate" });
	});

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
