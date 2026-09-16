/** fetch wrapper: JSON + credentials, trả lỗi dễ đọc khi proxy/server trả text thường. */
export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
	const res = await fetch(path, {
		credentials: "include",
		headers: options.body ? { "content-type": "application/json" } : undefined,
		...options,
	});
	const text = await res.text();
	let data = {} as T & { error?: string; message?: string };
	if (text) {
		try {
			data = JSON.parse(text) as T & { error?: string; message?: string };
		} catch {
			throw new Error(res.ok ? "Server returned an invalid response" : text);
		}
	}
	if (!res.ok) {
		const err = data as { error?: unknown; message?: unknown };
		const msg = typeof err.error === "string" ? err.error : typeof err.message === "string" ? err.message : `HTTP ${res.status}`;
		throw new Error(msg);
	}
	return data;
}

export async function apiJson<T = unknown>(path: string, method: string, body: unknown): Promise<T> {
	return api<T>(path, { method, body: JSON.stringify(body) });
}
