import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import { ShieldCheck } from "lucide-react";
import type { Me } from "@web/components/shell";
import { OnboardingPass } from "./onboarding-pass";

interface ViewPassDialogProps {
	me: Me;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ViewPassDialog({ me, open, onOpenChange }: ViewPassDialogProps) {
	const { t } = useTranslation();
	const passUser = {
		id: me.id,
		displayName: me.displayName || me.email.split("@")[0] || "User",
		username: me.username || me.email.split("@")[0] || "user",
		department: me.department,
		avatarUrl: me.avatarUrl,
		role: me.role,
		packageName: me.packageName,
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md border-0 bg-transparent p-0 shadow-none">
				<DialogHeader className="sr-only">
					<DialogTitle>Thẻ truy cập MNRouter</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col items-center gap-3">
					<div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-white backdrop-blur-md border border-white/20">
						<ShieldCheck className="h-3.5 w-3.5 text-accent-bright" /> {t("onboarding.officialPass", "OFFICIAL ACCESS PASS")}
					</div>
					<OnboardingPass user={passUser} stamped={true} />
				</div>
			</DialogContent>
		</Dialog>
	);
}
