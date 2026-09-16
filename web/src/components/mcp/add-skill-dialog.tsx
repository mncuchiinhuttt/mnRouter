import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { Input, Label } from "@web/components/ui/primitives";
import { FileCode, Plus, Upload } from "lucide-react";
import { toast } from "sonner";

interface AddSkillDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (data: { name?: string; description?: string; rawMarkdown: string }) => void;
	loading?: boolean;
}

export function AddSkillDialog({ open, onOpenChange, onSubmit, loading }: AddSkillDialogProps) {
	const { t } = useTranslation();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [markdown, setMarkdown] = useState("");

	const parseMd = (text: string) => {
		let extractedName = "";
		let extractedDesc = "";

		const fmMatch = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
		if (fmMatch) {
			const yaml = fmMatch[1] || "";
			for (const l of yaml.split("\n")) {
				const [k, ...v] = l.split(":");
				if (!k || !v.length) continue;
				const key = k.trim().toLowerCase();
				const val = v.join(":").trim().replace(/^["']|["']$/g, "");
				if (key === "name" || key === "title") extractedName = val;
				if (key === "description" || key === "desc") extractedDesc = val;
			}
		} else {
			const h1 = text.match(/^#\s+(.+)$/m);
			if (h1 && h1[1]) extractedName = h1[1].trim();
			const lines = text.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
			if (lines.length > 0 && lines[0]) extractedDesc = lines[0].trim().slice(0, 160);
		}

		if (extractedName && !name) setName(extractedName);
		if (extractedDesc && !description) setDescription(extractedDesc);
	};

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (!file.name.endsWith(".md") && !file.name.endsWith(".markdown") && !file.name.endsWith(".txt")) {
			toast.error(t("skills.fileTypeNotice"));
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			const text = reader.result as string;
			setMarkdown(text);
			parseMd(text);
			if (!name) setName(file.name.replace(/\.[^/.]+$/, ""));
		};
		reader.readAsText(file);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!markdown.trim()) {
			toast.error(t("skills.missingContent"));
			return;
		}
		onSubmit({
			name: name.trim() || undefined,
			description: description.trim() || undefined,
			rawMarkdown: markdown.trim(),
		});
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<form onSubmit={handleSubmit} className="space-y-4">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<FileCode className="size-4 text-accent" />
							<span>{t("skills.addTitle")}</span>
						</DialogTitle>
						<DialogDescription>
							{t("skills.addDesc")}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-3 font-mono text-xs">
						{/* Upload File button */}
						<div className="rounded-xl border border-dashed border-line bg-paper p-3 text-center">
							<label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 font-mono text-xs text-ink hover:border-accent hover:text-accent shadow-2xs">
								<Upload className="size-3.5 text-accent" />
								<span>{t("skills.chooseFile")}</span>
								<input type="file" accept=".md,.markdown,.txt" className="hidden" onChange={handleFileUpload} />
							</label>
							<p className="mt-1.5 text-[10.5px] text-ink-2/70">{t("skills.orPaste")}</p>
						</div>

						{/* Name & Description */}
						<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
							<div className="space-y-1">
								<Label className="text-[11px] uppercase tracking-wider text-ink-2">{t("skills.skillName")}</Label>
								<Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("skills.skillNamePlaceholder")} className="h-8.5 font-sans" />
							</div>
							<div className="space-y-1">
								<Label className="text-[11px] uppercase tracking-wider text-ink-2">{t("skills.shortDesc")}</Label>
								<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("skills.shortDescPlaceholder")} className="h-8.5 font-sans" />
							</div>
						</div>

						{/* Markdown Content */}
						<div className="space-y-1">
							<Label className="text-[11px] uppercase tracking-wider text-ink-2">{t("skills.mdContent")} *</Label>
							<textarea
								value={markdown}
								onChange={(e) => {
									setMarkdown(e.target.value);
									parseMd(e.target.value);
								}}
								placeholder="# Tên Kỹ năng&#10;&#10;Mô tả chi tiết và các chỉ dẫn prompt cho AI..."
								rows={8}
								required
								className="w-full rounded-md border border-line bg-paper p-2.5 font-mono text-xs focus:outline-none focus:border-accent leading-relaxed"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							{t("mcp.cancel")}
						</Button>
						<Button type="submit" disabled={loading} className="gap-1.5 font-mono text-xs">
							<Plus className="size-3.5" />
							{loading ? t("skills.savingBtn") : t("skills.saveBtn")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
