const CLEAN_PRINT_STYLE = `<style id="mnrouter-clean-print">
button[style*="28a745"], button[style*="green"], .print-btn, button[onclick*="print"] {
  background: #0f172a !important;
  color: #ffffff !important;
  border-radius: 9999px !important;
  border: 1px solid rgba(255,255,255,0.2) !important;
  font-family: ui-sans-serif, system-ui, sans-serif !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  padding: 6px 14px !important;
  box-shadow: 0 4px 14px rgba(0,0,0,0.2) !important;
  transition: all 0.2s ease !important;
  cursor: pointer !important;
}
button[style*="28a745"]:hover, button[style*="green"]:hover, .print-btn:hover, button[onclick*="print"]:hover {
  background: #1e293b !important;
  transform: translateY(-1px) !important;
}
@media print {
  button, .no-print, [onclick*="print"] { display: none !important; }
}
</style>`;

const SVG_PRINTER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1.5px;margin-right:6px;"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>`;

export function getBeautifiedHtml(content: string): string {
	if (!content.includes("<html") && !content.includes("<body")) return content;
	const res = content.replace(/🖨\s*/g, SVG_PRINTER_ICON);
	if (res.includes("</head>")) {
		return res.replace("</head>", `${CLEAN_PRINT_STYLE}</head>`);
	}
	return `${CLEAN_PRINT_STYLE}${res}`;
}
