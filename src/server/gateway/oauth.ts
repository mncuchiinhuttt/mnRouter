/**
 * OAuth flows per provider: refresh + PKCE exchange + device flow + authorize URLs.
 * clientId/endpoint values lấy từ bundle 9router (provider registry).
 */
import { createHash, randomBytes } from "node:crypto";
import { PROVIDERS, type ProviderId } from "./registry.js";
import { UpstreamError } from "./canonical.js";

export function pkcePair() {
	const verifier = randomBytes(32).toString("base64url");
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	return { verifier, challenge };
}

interface TokenResult {
	accessToken: string;
	refreshToken?: string;
	expiresIn: number;
	extra?: Record<string, unknown>;
}

async function tokenRequest(url: string, body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<TokenResult> {
	const res = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json", accept: "application/json", ...headers },
		body: JSON.stringify(body),
	});
	const json = (await res.json().catch(() => ({}))) as Record<string, any>;
	if (!res.ok) {
		throw new UpstreamError(json.error_description ?? json.error ?? json.message ?? `token endpoint ${res.status}`, res.status, "oauth_error", false);
	}
	const accessToken = json.access_token ?? json.accessToken;
	if (!accessToken) {
		throw new UpstreamError("token endpoint returned no access token", res.status, "oauth_error", false);
	}
	return {
		accessToken,
		refreshToken: json.refresh_token ?? json.refreshToken,
		expiresIn: json.expires_in ?? json.expiresIn ?? 3600,
		extra: json,
	};
}

/** Refresh an existing OAuth connection. Returns updated token fields. */
export async function refreshProviderToken(provider: ProviderId, data: Record<string, any>): Promise<TokenResult> {
	const cfg = PROVIDERS[provider];
	const refreshToken = data.refreshToken;
	if (!refreshToken) throw new UpstreamError("missing refresh token", 401, "no_credentials", false);

	if (provider === "claude") {
		return tokenRequest(cfg.oauth!.tokenUrl!, {
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: cfg.oauth!.clientId,
		});
	}
	if (provider === "codex") {
		const res = await tokenRequest(cfg.oauth!.tokenUrl!, {
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: cfg.oauth!.clientId,
			scope: cfg.oauth!.scopes,
		});
		return res;
	}
	if (provider === "grok") {
		return tokenRequest(cfg.oauth!.tokenUrl!, {
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: cfg.oauth!.clientId,
			scope: cfg.oauth!.scopes,
		});
	}
	if (provider === "antigravity") {
		return tokenRequest(cfg.oauth!.tokenUrl!, {
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: cfg.oauth!.clientId,
			client_secret: cfg.oauth!.clientSecret,
		});
	}
	// kiro: endpoint kiro.dev trước (chỉ cần refreshToken), AWS SSO OIDC là fallback
	if (!data.ssoOnly) {
		const res = await fetch(cfg.oauth!.tokenUrl!, {
			method: "POST",
			headers: { "content-type": "application/json", accept: "application/json", "user-agent": "kiro-cli/1.0.0" },
			body: JSON.stringify({ refreshToken }),
		});
		const json = (await res.json().catch(() => ({}))) as Record<string, any>;
		const accessToken = json.accessToken ?? json.access_token;
		if (res.ok && accessToken) {
			return {
				accessToken,
				refreshToken: json.refreshToken ?? json.refresh_token ?? refreshToken,
				expiresIn: typeof json.expiresAt === "number" ? Math.max(60, Math.floor((json.expiresAt - Date.now()) / 1000)) : json.expiresIn ?? json.expires_in ?? 3600,
				extra: json,
			};
		}
		if (!data.ssoClientId) {
			throw new UpstreamError(json.message ?? json.error ?? `kiro refresh ${res.status}`, res.status, "oauth_error", false);
		}
		// fall through to AWS SSO
	}
	if (data.ssoClientId && data.ssoClientSecret && data.ssoRegion) {
		// AWS SSO OIDC createToken dùng camelCase
		const res = await tokenRequest(`https://oidc.${data.ssoRegion}.amazonaws.com/token`, {
			grantType: "refresh_token",
			clientId: data.ssoClientId,
			clientSecret: data.ssoClientSecret,
			refreshToken,
		});
		return res;
	}
	throw new UpstreamError("kiro refresh failed: no usable method", 401, "oauth_error", false);
}

/** Exchange an authorization code (PKCE) — claude, codex & grok. */
export async function exchangeCode(provider: ProviderId, code: string, verifier: string): Promise<TokenResult> {
	if (provider === "claude") {
		return tokenRequest(PROVIDERS.claude.oauth!.tokenUrl!, {
			grant_type: "authorization_code",
			code,
			client_id: PROVIDERS.claude.oauth!.clientId,
			redirect_uri: "https://console.anthropic.com/oauth/code/callback",
			code_verifier: verifier,
		});
	}
	if (provider === "codex") {
		return tokenRequest(PROVIDERS.codex.oauth!.tokenUrl!, {
			grant_type: "authorization_code",
			code,
			client_id: PROVIDERS.codex.oauth!.clientId,
			redirect_uri: "http://localhost:1455/auth/callback",
			code_verifier: verifier,
		});
	}
	if (provider === "grok") {
		return tokenRequest(PROVIDERS.grok.oauth!.tokenUrl!, {
			grant_type: "authorization_code",
			code,
			client_id: PROVIDERS.grok.oauth!.clientId,
			redirect_uri: "http://127.0.0.1:56121/callback",
			code_verifier: verifier,
		});
	}
	throw new UpstreamError(`exchange not supported for ${provider}`, 400, "unsupported", false);
}

/** Build the authorize URL for PKCE providers. Returns url + verifier to keep. */
export function authorizeUrl(provider: ProviderId, challenge: string, state: string): string {
	const cfg = PROVIDERS[provider];
	if (provider === "claude") {
		const params = new URLSearchParams({
			code: "true",
			client_id: cfg.oauth!.clientId!,
			response_type: "code",
			redirect_uri: "https://console.anthropic.com/oauth/code/callback",
			scope: cfg.oauth!.scopes!,
			state,
			code_challenge: challenge,
			code_challenge_method: "S256",
		});
		return `${cfg.oauth!.authorizeUrl}?${params}`;
	}
	if (provider === "codex") {
		const params = new URLSearchParams({
			response_type: "code",
			client_id: cfg.oauth!.clientId!,
			redirect_uri: "http://localhost:1455/auth/callback",
			scope: cfg.oauth!.scopes!,
			state,
			code_challenge: challenge,
			code_challenge_method: "S256",
			id_token_add_organizations: "true",
			codex_cli_simplified_flow: "true",
			originator: "codex_cli_rs",
		});
		return `${cfg.oauth!.authorizeUrl}?${params}`;
	}
	if (provider === "grok") {
		const params = new URLSearchParams({
			response_type: "code",
			client_id: cfg.oauth!.clientId!,
			redirect_uri: "http://127.0.0.1:56121/callback",
			scope: cfg.oauth!.scopes!,
			state,
			code_challenge: challenge,
			code_challenge_method: "S256",
		});
		return `${cfg.oauth!.authorizeUrl}?${params}`;
	}
	throw new UpstreamError(`authorize url not supported for ${provider}`, 400, "unsupported", false);
}

/** Decode JWT payload without verification (to extract account ids). */
export function decodeJwtClaims(jwt: string): Record<string, any> {
	try {
		const payload = jwt.split(".")[1]!;
		return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, any>;
	} catch {
		return {};
	}
}

/** Kiro AWS SSO device flow — start. */
export async function kiroDeviceStart() {
	const registerRes = (await (
		await fetch("https://oidc.us-east-1.amazonaws.com/client/register", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				clientName: "kiro-oauth-client",
				clientType: "public",
				grantTypes: ["authorization_code", "refresh_token", "urn:ietf:params:oauth:grant-type:device_code"],
				issuerUrl: "https://identitycenter.amazonaws.com/ssoins-xxxxxxxx",
				redirectUris: ["http://127.0.0.1/oauth/callback"],
				scopes: ["codewhisperer:completions", "codewhisperer:analysis", "codewhisperer:conversations"],
			}),
		})
	).json()) as Record<string, any>;
	if (!registerRes.clientId) throw new UpstreamError("kiro device register failed", 502, "oauth_error", true);

	const deviceRes = (await (
		await fetch("https://oidc.us-east-1.amazonaws.com/device_authorization", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				clientId: registerRes.clientId,
				clientSecret: registerRes.clientSecret,
				startUrl: "https://view.awsapps.com/start",
			}),
		})
	).json()) as Record<string, any>;

	return {
		deviceCode: deviceRes.deviceCode as string,
		userCode: deviceRes.userCode as string,
		verificationUri: deviceRes.verificationUriComplete ?? deviceRes.verificationUri,
		interval: deviceRes.interval ?? 5,
		expiresIn: deviceRes.expiresIn ?? 600,
		clientId: registerRes.clientId as string,
		clientSecret: registerRes.clientSecret as string,
	};
}

/** Kiro device flow — poll for token. */
export async function kiroDevicePoll(deviceCode: string, clientId: string, clientSecret: string): Promise<TokenResult | { pending: true }> {
	const res = await fetch("https://oidc.us-east-1.amazonaws.com/token", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			grant_type: "urn:ietf:params:oauth:grant-type:device_code",
			deviceCode,
			clientId,
			clientSecret,
		}),
	});
	const json = (await res.json().catch(() => ({}))) as Record<string, any>;
	if (json.error === "authorization_pending" || json.error === "slow_down") return { pending: true };
	if (!res.ok || !json.accessToken) {
		throw new UpstreamError(json.error ?? `kiro device poll ${res.status}`, res.status, "oauth_error", false);
	}
	return { accessToken: json.accessToken, refreshToken: json.refreshToken, expiresIn: json.expiresIn ?? 28800, extra: json };
}
