export function detectAutoSkills(
	content: string,
	files?: { filename: string; mimeType: string }[],
): string[] {
	const set = new Set<string>();

	// 1. Auto-detect from file types
	if (files && files.length > 0) {
		for (const f of files) {
			const ext = f.filename.split(".").pop()?.toLowerCase() ?? "";
			const mime = f.mimeType.toLowerCase();
			if (
				["pdf", "docx", "doc", "xlsx", "xls", "csv", "txt", "md"].includes(ext) ||
				mime.includes("pdf") ||
				mime.includes("document") ||
				mime.includes("spreadsheet")
			) {
				set.add("pdf-document-analyst");
			}
		}
	}

	// 2. Auto-detect from user prompt intent
	const lp = content.toLowerCase();
	if (/\b(pptx|slide|slides|presentation|thuyết trình|thuyet trinh|powerpoint|deck)\b/i.test(lp)) set.add("pptx-creator");
	if (/\b(debug|bug|traceback|stack trace|fix bug|bị lỗi|bi loi|crash|exception)\b/i.test(lp)) set.add("debug-expert");
	if (/\b(security|vulnerability|injection|xss|csrf|ssrf|owasp|lỗ hổng|bảo mật|penetration|pentest)\b/i.test(lp)) set.add("security-audit");
	if (/\b(system design|architecture|microservice|database sharding|scale|scaling|kiến trúc hệ thống|phân tán)\b/i.test(lp)) set.add("system-design");
	if (/\b(academic paper|bài báo khoa học|nghiên cứu khoa học|literature review|apa 7th|ieee paper)\b/i.test(lp)) set.add("academic-paper");
	if (/\b(peer review|phản biện bài báo|critique paper|đánh giá bài báo)\b/i.test(lp)) set.add("academic-reviewer");

	// 3. Marketing & Non-coding Skills Auto-detection
	if (/\b(copywriting|viết copy|quảng cáo|facebook ads|tiktok ads|bán hàng|landing page|chốt sale|aida|pas|cta|headline)\b/i.test(lp)) set.add("copywriting-pro");
	if (/\b(viral|tiktok|reels|threads|facebook post|bài đăng fanpage|kịch bản video|shorts|bài đăng mạng xã hội|mạng xã hội|social media|caption)\b/i.test(lp)) set.add("social-media-viral");
	if (/\b(seo|chuẩn seo|bài seo|meta title|meta description|bài pr|bài blog|từ khóa|lsi|search intent)\b/i.test(lp)) set.add("seo-content-master");
	if (/\b(kế hoạch marketing|chiến lược marketing|marketing plan|growth hack|product launch|ra mắt sản phẩm|phễu bán hàng|funnel|định vị thương hiệu|chân dung khách hàng)\b/i.test(lp)) set.add("marketing-growth-strategist");
	if (/\b(storytelling|kể chuyện|kịch bản youtube|kịch bản podcast|câu chuyện thương hiệu|brand story|newsletter|biên kịch)\b/i.test(lp)) set.add("creative-storyteller");
	return Array.from(set);
}
