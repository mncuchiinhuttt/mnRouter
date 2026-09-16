import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { Button } from "@web/components/ui/button";
import { BookOpen, Bug, Check, Cpu, FileText, GraduationCap, Layers, Maximize2, Presentation, Rocket, Search, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { HARNESS_SKILLS, type HarnessSkill } from "@shared/skills";

interface CustomSkillProp {
	id: string;
	name: string;
	slug?: string;
	description?: string | null;
	enabled?: boolean;
}

interface SkillsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedSkills: string[];
	onToggleSkill: (skillId: string) => void;
	customSkills?: CustomSkillProp[];
}

export function SkillsDialog({ open, onOpenChange, selectedSkills, onToggleSkill, customSkills = [] }: SkillsDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Zap className="size-4 text-accent" />
						<span>Harness Agent Skills</span>
					</DialogTitle>
					<DialogDescription>
						Chọn các kỹ năng chuyên môn để định hình tư duy và chất lượng câu trả lời của AI.
					</DialogDescription>
				</DialogHeader>

				<div className="grid max-h-[60vh] gap-2.5 overflow-y-auto p-1 sm:grid-cols-2">
					{HARNESS_SKILLS.map((skill) => {
						const isSelected = selectedSkills.includes(skill.id);
						return (
							<div
								key={skill.id}
								onClick={() => onToggleSkill(skill.id)}
								className={`group relative flex flex-col justify-between rounded-lg border p-3.5 transition cursor-pointer ${
									isSelected ? "border-accent bg-[#f6f8ff] shadow-xs" : "border-line bg-white hover:border-ink-2/60"
								}`}
							>
								<div className="space-y-1.5">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<div className={`flex size-6 items-center justify-center rounded-md ${isSelected ? "bg-accent text-white" : "bg-paper-2 text-ink"}`}>
												<SkillIcon icon={skill.icon} className="size-3.5" />
											</div>
											<span className="font-semibold text-xs text-ink">{skill.name}</span>
										</div>
										<div className={`flex size-4 items-center justify-center rounded border ${isSelected ? "border-accent bg-accent text-white" : "border-line"}`}>
											{isSelected && <Check className="size-3" />}
										</div>
									</div>
									<p className="text-[11.5px] text-ink-2 leading-relaxed">{skill.description}</p>
								</div>
							</div>
						);
					})}

					{customSkills.filter((cs) => cs.enabled !== false).map((skill) => {
						const isSelected = selectedSkills.includes(skill.id);
						return (
							<div
								key={skill.id}
								onClick={() => onToggleSkill(skill.id)}
								className={`group relative flex flex-col justify-between rounded-lg border p-3.5 transition cursor-pointer ${
									isSelected ? "border-accent bg-[#f6f8ff] shadow-xs" : "border-line bg-white hover:border-ink-2/60"
								}`}
							>
								<div className="space-y-1.5">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<div className={`flex size-6 items-center justify-center rounded-md ${isSelected ? "bg-accent text-white" : "bg-paper-2 text-ink"}`}>
												<Sparkles className="size-3.5" />
											</div>
											<span className="font-semibold text-xs text-ink">{skill.name}</span>
										</div>
										<span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-accent/10 text-accent font-semibold">.MD</span>
									</div>
									<p className="text-[11.5px] text-ink-2 leading-relaxed">{skill.description || "Kỹ năng tùy chỉnh từ Markdown"}</p>
								</div>
							</div>
						);
					})}
				</div>
				<DialogFooter>
					<Button onClick={() => onOpenChange(false)}>Xong</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function SkillIcon({ icon, className }: { icon: HarnessSkill["icon"]; className?: string }) {
	switch (icon) {
		case "Cpu": return <Cpu className={className} />;
		case "Bug": return <Bug className={className} />;
		case "ShieldCheck": return <ShieldCheck className={className} />;
		case "Maximize2": return <Maximize2 className={className} />;
		case "Sparkles": return <Sparkles className={className} />;
		case "Layers": return <Layers className={className} />;
		case "Search": return <Search className={className} />;
		case "Rocket": return <Rocket className={className} />;
		case "GraduationCap": return <GraduationCap className={className} />;
		case "BookOpen": return <BookOpen className={className} />;
		case "Presentation": return <Presentation className={className} />;
		case "FileText": return <FileText className={className} />;
		default: return <Sparkles className={className} />;
	}
}
