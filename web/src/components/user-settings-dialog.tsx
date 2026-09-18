import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Camera, Check, Lock, User, AtSign } from "lucide-react";
import { apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Input, Label } from "@web/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";
import type { Me } from "./shell";
import { compressImage, MAX_AVATAR_BYTES } from "@web/lib/image-compress";

interface UserSettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	me: Me;
}

export function UserSettingsDialog({ open, onOpenChange, me }: UserSettingsDialogProps) {
	const { t } = useTranslation();
	const qc = useQueryClient();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [displayName, setDisplayName] = useState(me.displayName || "");
	const [username, setUsername] = useState(me.username || "");
	const [department, setDepartment] = useState(me.department || "");
	const [avatarUrl, setAvatarUrl] = useState<string>(me.avatarUrl || "");
	const [isCompressing, setIsCompressing] = useState(false);

	const save = useMutation({
		mutationFn: () =>
			apiJson("/api/me/profile", "PATCH", {
				displayName,
				username: username.replace(/^@+/, ""),
				department,
				avatarUrl,
			}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["me"] });
			toast.success(t("userSettings.savedToast"));
			onOpenChange(false);
		},
		onError: (err) => toast.error((err as Error).message),
	});

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (file.size > MAX_AVATAR_BYTES) {
			toast.error(t("userSettings.avatarSizeLimit"));
			return;
		}
		try {
			setIsCompressing(true);
			const compressed = await compressImage(file);
			setAvatarUrl(compressed);
			toast.success(t("userSettings.avatarCompressed"));
		} catch {
			toast.error("Không thể xử lý ảnh này");
		} finally {
			setIsCompressing(false);
		}
	};

	const initials = (displayName || me.email).slice(0, 2).toUpperCase();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>{t("userSettings.title")}</DialogTitle>
					<DialogDescription>{t("userSettings.desc")}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					{/* Avatar Section */}
					<div className="flex items-center gap-4 border-b border-line pb-4">
						<div className="relative group size-16 shrink-0 rounded-full border border-line bg-paper-2 overflow-hidden flex items-center justify-center font-mono font-bold text-lg text-ink">
							{avatarUrl ? (
								<img src={avatarUrl} alt="" className="size-full object-cover" />
							) : (
								<span>{initials}</span>
							)}
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								disabled={isCompressing}
								className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
								title={t("userSettings.uploadAvatar")}
							>
								<Camera className="size-5" />
							</button>
						</div>

						<div className="space-y-1 text-xs font-mono min-w-0">
							<div className="flex items-center gap-2">
								<Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()} disabled={isCompressing}>
									<Camera className="size-3" />
									<span>{isCompressing ? t("common.loading") : t("userSettings.changeAvatar")}</span>
								</Button>
								{avatarUrl && (
									<Button size="sm" variant="ghost" className="h-7 text-xs text-[#c6293b] hover:bg-[#fae8eb]" onClick={() => setAvatarUrl("")}>
										{t("userSettings.removeAvatar")}
									</Button>
								)}
							</div>
							<p className="text-[10px] text-ink-2 leading-relaxed">
								{t("userSettings.avatarNotice")}
							</p>
						</div>

						<input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileSelect} />
					</div>

					{/* Form Fields */}
					<div className="space-y-3 font-mono text-xs">
						{/* Email (Read only) */}
						<div className="space-y-1">
							<Label className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-ink-2">
								<Lock className="size-3 text-ink-2" />
								<span>Email ({t("userSettings.loginEmail")})</span>
							</Label>
							<Input value={me.email} disabled className="h-8 bg-paper-2 text-ink-2 font-mono text-xs cursor-not-allowed" />
						</div>

						{/* Username */}
						<div className="space-y-1">
							<Label className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-ink-2">
								<AtSign className="size-3 text-accent" />
								<span>Username</span>
							</Label>
							<Input
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								placeholder="alex_dev"
								className="h-8 font-mono text-xs"
							/>
						</div>

						{/* Display Name */}
						<div className="space-y-1">
							<Label className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-ink-2">
								<User className="size-3 text-accent" />
								<span>{t("userSettings.displayName")}</span>
							</Label>
							<Input
								data-tour="user-display-name-input"
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
								placeholder="Alex Morgan"
								className="h-8 font-mono text-xs"
							/>
						</div>

						{/* Department / Organization Unit */}
						<div className="space-y-1">
							<Label className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-ink-2">
								<Building2 className="size-3 text-accent" />
								<span>{t("userSettings.department")}</span>
							</Label>
							<Input
								value={department}
								onChange={(e) => setDepartment(e.target.value)}
								placeholder="Engineering & AI Team"
								className="h-8 font-mono text-xs"
							/>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{t("common.cancel")}
					</Button>
					<Button onClick={() => save.mutate()} disabled={save.isPending || isCompressing}>
						<Check className="size-3.5" />
						<span>{t("common.save")}</span>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
