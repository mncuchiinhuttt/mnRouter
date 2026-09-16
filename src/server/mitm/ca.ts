import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import tls from "node:tls";

export const MITM_DIR = join(process.cwd(), "data", "mitm");
export const CERTS_DIR = join(MITM_DIR, "certs");
export const CA_KEY_PATH = join(MITM_DIR, "rootCA.key");
export const CA_CRT_PATH = join(MITM_DIR, "rootCA.crt");

export function ensureDirectories(): void {
	if (!existsSync(MITM_DIR)) mkdirSync(MITM_DIR, { recursive: true });
	if (!existsSync(CERTS_DIR)) mkdirSync(CERTS_DIR, { recursive: true });
}

export function getOrCreateRootCA(): { keyPath: string; crtPath: string } {
	ensureDirectories();
	if (existsSync(CA_KEY_PATH) && existsSync(CA_CRT_PATH)) {
		return { keyPath: CA_KEY_PATH, crtPath: CA_CRT_PATH };
	}

	execSync(
		`openssl req -x509 -newkey rsa:2048 -nodes -keyout "${CA_KEY_PATH}" -out "${CA_CRT_PATH}" -days 3650 -subj "/CN=mnRouter MITM Root CA/O=mnRouter" 2>/dev/null`,
	);
	return { keyPath: CA_KEY_PATH, crtPath: CA_CRT_PATH };
}

const secureContextCache = new Map<string, tls.SecureContext>();

export function getSecureContextForDomain(domain: string): tls.SecureContext {
	if (secureContextCache.has(domain)) {
		return secureContextCache.get(domain)!;
	}

	const { keyPath, crtPath } = getOrCreateRootCA();
	const leafKey = join(CERTS_DIR, `${domain}.key`);
	const leafCrt = join(CERTS_DIR, `${domain}.crt`);
	const leafCsr = join(CERTS_DIR, `${domain}.csr`);
	const extFile = join(CERTS_DIR, `${domain}.ext`);

	if (!existsSync(leafKey) || !existsSync(leafCrt)) {
		execSync(`openssl req -newkey rsa:2048 -nodes -keyout "${leafKey}" -out "${leafCsr}" -subj "/CN=${domain}" 2>/dev/null`);
		const extContent = `subjectAltName=DNS:${domain},DNS:*.${domain}\nbasicConstraints=CA:FALSE\n`;
		require("node:fs").writeFileSync(extFile, extContent, "utf8");
		execSync(`openssl x509 -req -in "${leafCsr}" -CA "${crtPath}" -CAkey "${keyPath}" -CAcreateserial -out "${leafCrt}" -days 365 -extfile "${extFile}" 2>/dev/null`);
	}

	const key = readFileSync(leafKey, "utf8");
	const cert = `${readFileSync(leafCrt, "utf8")}\n${readFileSync(crtPath, "utf8")}`;
	const ctx = tls.createSecureContext({ key, cert });
	secureContextCache.set(domain, ctx);
	return ctx;
}

export function getTrustCertCommand(os: "mac" | "win" | "linux"): string {
	const crt = CA_CRT_PATH;
	if (os === "mac") {
		return `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${crt}"`;
	}
	if (os === "win") {
		return `certutil -addstore Root "${crt}"`;
	}
	return `sudo cp "${crt}" /usr/local/share/ca-certificates/mnrouter-mitm.crt && sudo update-ca-certificates`;
}

export function getUntrustCertCommand(os: "mac" | "win" | "linux"): string {
	if (os === "mac") {
		return `sudo security delete-certificate -c "mnRouter MITM Root CA" /Library/Keychains/System.keychain 2>/dev/null || true`;
	}
	if (os === "win") {
		return `certutil -delstore Root "mnRouter MITM Root CA"`;
	}
	return `sudo rm -f /usr/local/share/ca-certificates/mnrouter-mitm.crt && sudo update-ca-certificates`;
}
