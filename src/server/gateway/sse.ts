/** Minimal SSE line parser: feeds arbitrary text chunks, yields `data:` payload strings. */
export function createSseParser(onData: (payload: string) => void, onEvent?: (event: string) => void) {
	let buffer = "";
	let eventName = "";
	return {
		push(chunk: string) {
			buffer += chunk;
			let idx: number;
			while ((idx = buffer.indexOf("\n")) >= 0) {
				const line = buffer.slice(0, idx).replace(/\r$/, "");
				buffer = buffer.slice(idx + 1);
				if (line === "") {
					if (eventName) {
						onEvent?.(eventName);
						eventName = "";
					}
					continue;
				}
				if (line.startsWith("event:")) {
					eventName = line.slice(6).trim();
					continue;
				}
				if (line.startsWith("data:")) {
					onData(line.slice(5).trimStart());
				}
			}
		},
		flush() {
			if (buffer.startsWith("data:")) onData(buffer.slice(5).trimStart());
			buffer = "";
		},
	};
}

export function sseChunk(data: unknown): string {
	return `data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
}
