export async function extractTextFromFile(params: {
	filename: string;
	mimeType: string;
	buffer: Buffer;
	maxChars?: number;
}): Promise<string> {
	const { filename, mimeType, buffer, maxChars = 80_000 } = params;
	const ext = filename.split(".").pop()?.toLowerCase() ?? "";

	try {
		// 1. PDF Documents
		if (ext === "pdf" || mimeType === "application/pdf") {
			try {
				const { extractText } = await import("unpdf");
				const res = await extractText(new Uint8Array(buffer));
				const combined = Array.isArray(res.text) ? res.text.join("\n\n") : String(res.text || "");
				if (combined.trim()) {
					return truncate(combined, maxChars, `PDF (${res.totalPages || 1} pages)`);
				}
			} catch (unpdfErr) {
				console.error("[file-extractor] unpdf failed, trying stream fallback:", (unpdfErr as Error).message);
			}

			// Fallback: extract text blocks from PDF stream
			const rawStr = buffer.toString("latin1");
			const textMatches: string[] = [];
			const textRegex = /BT[\s\S]*?ET/g;
			let match: RegExpExecArray | null;
			while ((match = textRegex.exec(rawStr)) !== null) {
				const block = match[0];
				const strRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
				let m: RegExpExecArray | null;
				while ((m = strRegex.exec(block)) !== null) {
					if (m[1]) textMatches.push(m[1]);
				}
			}
			if (textMatches.length > 0) {
				return truncate(textMatches.join(" "), maxChars, "PDF (stream fallback)");
			}
			return `[PDF Document: ${filename} (${buffer.length} bytes)]`;
		}

		// 2. Word Documents (.docx)
		if (ext === "docx" || mimeType.includes("wordprocessingml") || mimeType.includes("msword")) {
			const mammoth = (await import("mammoth")).default;
			const res = await mammoth.extractRawText({ buffer });
			return truncate(res.value || "", maxChars, "Word Document (.docx)");
		}

		// 3. Excel Spreadsheets (.xlsx, .xls)
		if (ext === "xlsx" || ext === "xls" || mimeType.includes("spreadsheetml") || mimeType.includes("excel")) {
			const XLSX = await import("xlsx");
			const workbook = XLSX.read(buffer, { type: "buffer" });
			const sheets = workbook.SheetNames.map((name: string) => {
				const sheet = workbook.Sheets[name];
				if (!sheet) return "";
				const csv = XLSX.utils.sheet_to_csv(sheet);
				return `### Sheet: ${name}\n\`\`\`csv\n${csv}\n\`\`\``;
			}).filter(Boolean);
			return truncate(sheets.join("\n\n"), maxChars, "Excel Spreadsheet (.xlsx)");
		}

		// 4. Plain text / Code / Markdown / JSON / CSV
		const rawText = buffer.toString("utf-8");
		return truncate(rawText, maxChars, `Text Document (${ext.toUpperCase()})`);
	} catch (err) {
		return `[Error reading file ${filename}: ${(err as Error).message}]`;
	}
}

function truncate(text: string, max: number, typeLabel: string): string {
	const trimmed = text.trim();
	if (trimmed.length <= max) return trimmed;
	return (
		trimmed.slice(0, max) +
		`\n\n... [Content truncated at ${max.toLocaleString()} characters — ${typeLabel}]`
	);
}
