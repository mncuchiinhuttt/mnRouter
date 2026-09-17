import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, Sparkles, ChevronDown, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { HARNESS_SKILLS, type HarnessSkill } from "@shared/skills";
import { SkillIcon } from "@web/components/chat/skills-dialog";

interface BuiltInSkillsListProps {
	skills?: HarnessSkill[];
}

export function BuiltInSkillsList({ skills = HARNESS_SKILLS }: BuiltInSkillsListProps) {
	const { t } = useTranslation();
	const [searchQuery, setSearchQuery] = useState("");
	const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
	const [copiedId, setCopiedId] = useState<string | null>(null);

	const filteredSkills = useMemo(() => {
		if (!searchQuery.trim()) return skills;
		const q = searchQuery.toLowerCase().trim();
		return skills.filter(
			(s) =>
				s.name.toLowerCase().includes(q) ||
				s.shortName.toLowerCase().includes(q) ||
				s.id.toLowerCase().includes(q) ||
				s.description.toLowerCase().includes(q) ||
				s.prompt.toLowerCase().includes(q)
		);
	}, [skills, searchQuery]);

	const copyPrompt = (id: string, prompt: string) => {
		navigator.clipboard.writeText(prompt);
		setCopiedId(id);
		toast.success("Skill prompt copied to clipboard");
		setTimeout(() => setCopiedId(null), 2000);
	};

	return (
		<div className="space-y-4">
			{/* Search & Header Bar */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2">
					<span className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-2">
						System Skills Library
					</span>
					<span className="rounded-full bg-paper-2 border border-line px-2 py-0.5 font-mono text-[11px] text-ink font-bold">
						{filteredSkills.length} of {skills.length} skills
					</span>
				</div>

				<div className="relative w-full sm:w-72">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-2" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search built-in skills..."
						className="w-full rounded-lg border border-line bg-white pl-8 pr-3 py-1.5 font-mono text-xs text-ink placeholder:text-ink-2/60 focus:outline-none focus:border-accent shadow-2xs"
					/>
				</div>
			</div>

			{/* Skills Grid */}
			{filteredSkills.length === 0 ? (
				<div className="rounded-xl border border-dashed border-line bg-white/60 p-8 text-center space-y-2">
					<Sparkles className="size-8 mx-auto text-ink-2/40" />
					<p className="font-mono text-sm font-semibold text-ink">No skills found</p>
					<p className="text-xs text-ink-2">Try adjusting your search query.</p>
				</div>
			) : (
				<div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
					{filteredSkills.map((skill) => {
						const isExpanded = expandedSkillId === skill.id;

						return (
							<div
								key={skill.id}
								className={`rounded-xl border bg-white p-4 transition-all duration-200 shadow-2xs flex flex-col justify-between ${
									isExpanded
										? "border-accent ring-1 ring-accent/20"
										: "border-line hover:border-line-2 hover:shadow-xs"
								}`}
							>
								<div className="space-y-2.5">
									{/* Top Header */}
									<div className="flex items-start justify-between gap-2">
										<div className="flex items-center gap-2.5">
											<div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-paper-2 text-accent">
												<SkillIcon icon={skill.icon} className="size-4" />
											</div>
											<div className="min-w-0">
												<h4 className="font-mono text-xs font-bold text-ink truncate">
													{skill.name}
												</h4>
												<span className="font-mono text-[10px] text-ink-2/70 block truncate">
													#{skill.id}
												</span>
											</div>
										</div>

										<span className="shrink-0 font-mono text-[9.5px] font-semibold text-[#1d7a33] bg-[#f4faf5] border border-[#bcd9c0] px-1.5 py-0.5 rounded uppercase">
											Built-in
										</span>
									</div>

									{/* Description */}
									<p className="text-xs text-ink-2 leading-relaxed line-clamp-3">
										{skill.description}
									</p>
								</div>

								{/* Bottom Action & Expandable Prompt */}
								<div className="mt-3.5 pt-2.5 border-t border-line/60">
									<div className="flex items-center justify-between gap-2">
										<button
											type="button"
											onClick={() => setExpandedSkillId(isExpanded ? null : skill.id)}
											className="inline-flex items-center gap-1 font-mono text-[11px] text-accent hover:underline cursor-pointer"
										>
											<span>{isExpanded ? "Hide instructions" : "View instructions"}</span>
											<ChevronDown
												className={`size-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
											/>
										</button>

										<button
											type="button"
											onClick={() => copyPrompt(skill.id, skill.prompt)}
											className="rounded p-1 text-ink-2 hover:bg-paper-2 hover:text-ink transition cursor-pointer"
											title="Copy skill prompt"
										>
											{copiedId === skill.id ? (
												<Check className="size-3.5 text-[#1d7a33]" />
											) : (
												<Copy className="size-3.5" />
											)}
										</button>
									</div>

									{/* Expanded System Prompt View */}
									{isExpanded && (
										<div className="mt-2.5 rounded-lg border border-line/70 bg-paper/40 p-2.5 font-mono text-[11px] text-ink leading-relaxed whitespace-pre-wrap animate-in fade-in zoom-in-95 duration-150 max-h-48 overflow-y-auto [scrollbar-width:thin]">
											{skill.prompt}
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
