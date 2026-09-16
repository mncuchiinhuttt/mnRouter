import { Download, FileCode, Sparkles, Trash2, Edit3, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@web/components/ui/button";
import { Badge } from "@web/components/ui/primitives";

export interface CustomSkillItem {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	prompt: string;
	rawMarkdown: string;
	icon: string;
	enabled: boolean;
	createdAt: string;
	updatedAt: string;
}

interface CustomSkillsListProps {
	skills: CustomSkillItem[];
	onToggle: (id: string, enabled: boolean) => void;
	onDelete: (id: string) => void;
	onOpenAdd: () => void;
}

export function CustomSkillsList({
	skills,
	onToggle,
	onDelete,
	onOpenAdd,
}: CustomSkillsListProps) {
	const { t } = useTranslation();

	const handleDownload = (skill: CustomSkillItem) => {
		const blob = new Blob([skill.rawMarkdown], { type: "text/markdown;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${skill.slug || "skill"}.md`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="space-y-4">
			{skills.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white p-10 text-center space-y-3">
					<div className="flex size-12 items-center justify-center rounded-xl bg-paper-2 border border-line">
						<FileCode className="size-6 text-accent" />
					</div>
					<h3 className="font-sans text-base font-semibold text-ink">
						{t("skills.noSkills", "Chưa có kỹ năng tùy chỉnh nào")}
					</h3>
					<p className="max-w-md text-xs text-ink-2 leading-relaxed">
						{t("skills.noSkillsDesc", "Tải lên hoặc kéo thả các file .md chứa prompt kỹ năng của riêng bạn (Prompt Engineering, Domain Expert, Code Reviewer...).")}
					</p>
					<Button onClick={onOpenAdd} size="sm" className="gap-1.5 font-mono text-xs">
						<Plus className="size-3.5" />
						{t("skills.addSkill", "Thêm kỹ năng (.md)")}
					</Button>
				</div>
			) : (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{skills.map((s) => (
						<div
							key={s.id}
							className={`flex flex-col justify-between rounded-xl border bg-white p-4 shadow-xs transition ${
								!s.enabled ? "opacity-60 border-line" : "border-line hover:border-accent/40"
							}`}
						>
							<div className="space-y-3">
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<div className="flex size-6 items-center justify-center rounded-md bg-accent/10 text-accent">
												<Sparkles className="size-3.5" />
											</div>
											<Badge className="font-mono text-[9.5px] uppercase">
												.MD SKILL
											</Badge>
										</div>
										<h4 className="mt-2 truncate font-sans text-sm font-semibold text-ink" title={s.name}>
											{s.name}
										</h4>
										<div className="font-mono text-[10.5px] text-accent">
											@{s.slug}
										</div>
									</div>
								</div>

								<p className="line-clamp-2 text-xs text-ink-2 leading-relaxed">
									{s.description || "Tùy chỉnh kỹ năng từ file Markdown"}
								</p>

								{/* Prompt Preview snippet */}
								<div className="rounded-lg bg-paper-2 p-2.5 font-mono text-[11px] text-ink-2/80 line-clamp-3 leading-relaxed border border-line/40">
									{s.prompt}
								</div>
							</div>

							{/* Actions */}
							<div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 font-mono text-[11px]">
								<button
									type="button"
									onClick={() => onToggle(s.id, !s.enabled)}
									className={`font-medium cursor-pointer ${
										s.enabled ? "text-accent hover:underline" : "text-ink-2 hover:text-ink"
									}`}
								>
									{s.enabled ? t("common.enabled") : t("common.disabled")}
								</button>

								<div className="flex items-center gap-1.5">
									<Button
										size="sm"
										variant="outline"
										className="h-7 px-2 font-mono text-[10.5px] gap-1"
										onClick={() => handleDownload(s)}
										title={t("skills.downloadMd")}
									>
										<Download className="size-3" />
										.md
									</Button>
									<Button
										size="sm"
										variant="ghost"
										className="h-7 w-7 p-0 text-ink-2 hover:text-[#c6293b]"
										onClick={() => onDelete(s.id)}
										title={t("skills.deleteSkill")}
									>
										<Trash2 className="size-3.5" />
									</Button>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
