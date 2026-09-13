import { createHash, randomBytes } from "node:crypto";

/** SHA-256 hex of a token — tokens are only ever stored hashed. */
export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export function randomToken(bytes = 32): string {
	return randomBytes(bytes).toString("base64url");
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * API key format: mr_<43 base62 chars> (~256 bit entropy).
 * Returns the plaintext (shown once) plus its sha256 hash and 8-char prefix.
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
	const buf = randomBytes(43);
	let body = "";
	for (let i = 0; i < 43; i++) body += ALPHABET[buf[i]! % 62];
	const key = `mr_${body}`;
	return { key, hash: hashToken(key), prefix: key.slice(0, 11) };
}
