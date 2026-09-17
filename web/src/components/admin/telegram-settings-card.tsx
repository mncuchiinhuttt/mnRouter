import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, CheckCircle2, AlertCircle, Bot, Link, Bell } from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { Button } from "@web/components/ui/button";
import { Input, Label, Badge } from "@web/components/ui/primitives";
import { Switch } from "@web/components/ui/tabs-switch";

interface TelegramConfig {
	botToken: string;
	chatId: string;
	enabled: boolean;
	notifyCooldown: boolean;
	notifyErrors: boolean;
	notifyNewUsers: boolean;
	notifyDailyReport: boolean;
}

export function TelegramSettingsCard() {
	const { t } = useTranslation();
	const qc = useQueryClient();

	const { data, isLoading } = useQuery({
		queryKey: ["telegram-config"],
		queryFn: () => api<{ config: TelegramConfig }>("/api/admin/telegram"),
	});

	const [form, setForm] = useState<TelegramConfig>({
		botToken: "",
		chatId: "",
		enabled: false,
		notifyCooldown: true,
		notifyErrors: true,
		notifyNewUsers: true,
		notifyDailyReport: false,
	});

	const [testStatus, setTestStatus] = useState<{ ok?: boolean; message?: string } | null>(null);

	useEffect(() => {
		if (data?.config) {
			setForm(data.config);
		}
	}, [data]);

	const saveMutation = useMutation({
		mutationFn: () => apiJson("/api/admin/telegram", "PUT", form),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["telegram-config"] });
			toast.success(t("adminSettings.telegramSaved", "Telegram settings saved"));
		},
		onError: (err) => toast.error((err as Error).message),
	});

	const testMutation = useMutation({
		mutationFn: () => apiJson<{ ok: boolean; error?: string }>("/api/admin/telegram/test", "POST", {
			botToken: form.botToken,
			chatId: form.chatId,
		}),
		onSuccess: (res) => {
			if (res.ok) {
				setTestStatus({ ok: true, message: "Test message delivered to your Telegram!" });
				toast.success("Telegram test message sent!");
			} else {
				setTestStatus({ ok: false, message: res.error || "Failed to send message" });
				toast.error(res.error || "Failed to send message");
			}
		},
		onError: (err) => {
			setTestStatus({ ok: false, message: (err as Error).message });
			toast.error((err as Error).message);
		},
	});

	const webhookMutation = useMutation({
		mutationFn: () => apiJson<{ ok: boolean; description?: string; error?: string }>("/api/admin/telegram/webhook/set", "POST", {}),
		onSuccess: (res) => {
			if (res.ok) {
				toast.success("Telegram webhook set! You can now chat /status to your bot.");
			} else {
				toast.error(res.description || res.error || "Failed to set webhook");
			}
		},
		onError: (err) => toast.error((err as Error).message),
	});

	return (
		<div className="rounded-lg border border-line bg-white p-5 shadow-xs space-y-5">
			<div className="flex items-start justify-between gap-4">
				<div className="flex items-center gap-3">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-[#0088cc]/10 text-[#0088cc]">
						<Bot className="size-5" />
					</div>
					<div>
						<div className="flex items-center gap-2">
							<h2 className="text-lg font-semibold tracking-tight text-ink">
								{t("adminSettings.telegramTitle", "Telegram Server Monitoring Bot")}
							</h2>
							<Badge className={form.enabled && form.botToken && form.chatId ? "border-[#bcd9c0] text-[#1d7a33]" : "border-line text-ink-2"}>
								{form.enabled && form.botToken && form.chatId ? "Connected" : "Not Linked"}
							</Badge>
						</div>
						<p className="text-xs text-ink-2 mt-0.5">
							{t("adminSettings.telegramDesc", "Receive instant alerts for provider cooldowns, server errors, and query live status via Telegram bot.")}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					<Switch
						checked={form.enabled}
						onCheckedChange={(val) => setForm({ ...form, enabled: val })}
					/>
					<span className="label-mono text-xs text-ink-2">{form.enabled ? "ACTIVE" : "OFF"}</span>
				</div>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1.5">
					<Label htmlFor="telegram-token">
						{t("adminSettings.telegramToken", "Bot Token")}
					</Label>
					<Input
						id="telegram-token"
						type="password"
						value={form.botToken}
						onChange={(e) => setForm({ ...form, botToken: e.target.value })}
						placeholder="123456789:ABCdefGHIjklMNOpqrs..."
						className="font-mono text-xs"
					/>
					<p className="text-[11px] text-ink-2">
						{t("adminSettings.telegramTokenHint", "Create a bot via @BotFather on Telegram to get your token.")}
					</p>
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="telegram-chat-id">
						{t("adminSettings.telegramChatId", "Your Chat ID")}
					</Label>
					<Input
						id="telegram-chat-id"
						value={form.chatId}
						onChange={(e) => setForm({ ...form, chatId: e.target.value })}
						placeholder="123456789"
						className="font-mono text-xs"
					/>
					<p className="text-[11px] text-ink-2">
						{t("adminSettings.telegramChatIdHint", "Your user ID or group ID. Send a message to @userinfobot to find it.")}
					</p>
				</div>
			</div>

			<div className="rounded-md border border-line bg-paper/40 p-3 space-y-2.5">
				<div className="text-xs font-semibold text-ink flex items-center gap-1.5">
					<Bell className="size-3.5 text-accent" />
					<span>{t("adminSettings.telegramAlerts", "Notification Triggers")}</span>
				</div>
				<div className="grid gap-2 sm:grid-cols-2 text-xs">
					<label className="flex items-center gap-2 cursor-pointer text-ink">
						<input
							type="checkbox"
							checked={form.notifyCooldown}
							onChange={(e) => setForm({ ...form, notifyCooldown: e.target.checked })}
							className="rounded border-line"
						/>
						<span>{t("adminSettings.telegramNotifyCooldown", "Provider Cooldown & Token Expiry")}</span>
					</label>
					<label className="flex items-center gap-2 cursor-pointer text-ink">
						<input
							type="checkbox"
							checked={form.notifyNewUsers}
							onChange={(e) => setForm({ ...form, notifyNewUsers: e.target.checked })}
							className="rounded border-line"
						/>
						<span>{t("adminSettings.telegramNotifyNewUsers", "New User Registrations")}</span>
					</label>
				</div>
			</div>

			{testStatus && (
				<div className={`flex items-center gap-2 rounded-md p-2.5 text-xs font-mono border ${testStatus.ok ? "border-[#bcd9c0] bg-[#f4faf5] text-[#1d7a33]" : "border-[#e5bfc4] bg-[#fdf5f5] text-[#c6293b]"}`}>
					{testStatus.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
					<span>{testStatus.message}</span>
				</div>
			)}

			<div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-line">
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => testMutation.mutate()}
						disabled={testMutation.isPending || !form.botToken || !form.chatId}
					>
						<Send className="size-3.5" />
						{testMutation.isPending ? "Sending..." : t("adminSettings.telegramTestBtn", "Test Notification")}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => webhookMutation.mutate()}
						disabled={webhookMutation.isPending || !form.botToken}
						title="Enable /status and /stats commands on Telegram"
					>
						<Link className="size-3.5" />
						{webhookMutation.isPending ? "Configuring..." : t("adminSettings.telegramWebhookBtn", "Enable Bot Commands")}
					</Button>
				</div>

				<Button
					type="button"
					onClick={() => saveMutation.mutate()}
					disabled={saveMutation.isPending || isLoading}
				>
					{saveMutation.isPending ? "Saving..." : t("adminSettings.telegramSaveBtn", "Save Settings")}
				</Button>
			</div>
		</div>
	);
}
