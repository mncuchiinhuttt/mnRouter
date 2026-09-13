import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw, Copy, Ban } from "lucide-react";
import { api, apiJson } from "@web/lib/api";
import { fmtDate } from "@web/lib/utils";
import { Button } from "@web/components/ui/button";
import { Badge, TD, TH, TBody, THead, TR, Table } from "@web/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@web/components/ui/dialog";

interface KeysResp {
	keys: { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null; active: boolean }[];
	maxKeys: number;
}

export default function ApiKeys() {
	const qc = useQueryClient();
	const { data, isLoading } = useQuery({ queryKey: ["my-keys"], queryFn: () => api<KeysResp>("/api/me/keys") });
	const [newKey, setNewKey] = useState<string | null>(null);
	const [confirmRotate, setConfirmRotate] = useState<string | null>(null);

	const rotate = useMutation({
		mutationFn: (id: string) => apiJson<{ key: string }>(`/api/me/keys/${id}/rotate`, "POST", {}),
		onSuccess: (res) => {
			setNewKey(res.key);
			setConfirmRotate(null);
			qc.invalidateQueries({ queryKey: ["my-keys"] });
			toast.success("Key mới đã tạo, key cũ hết hiệu lực");
		},
		onError: (e) => toast.error((e as Error).message),
	});

	const revoke = useMutation({
		mutationFn: (id: string) => apiJson(`/api/me/keys/${id}/revoke`, "POST", {}),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["my-keys"] });
			toast.success("Đã thu hồi key");
		},
		onError: (e) => toast.error((e as Error).message),
	});

	return (
		<div className="space-y-8">
			<header className="flex items-end justify-between">
				<div>
					<h1 className="text-[44px] font-semibold leading-none tracking-tight">API Keys</h1>
					<p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2">
						Key do admin cấp. Bạn chỉ có thể <b>rotate</b> (tạo key mới, thu hồi cái cũ) hoặc thu hồi. Số key tối đa: <b className="font-mono">{data?.maxKeys ?? "?"}</b>.
					</p>
				</div>
				<div className="hidden text-right lg:block">
					<div className="label-mono text-ink-2">base url</div>
					<code className="rounded-xs bg-paper-2 px-2 py-1 font-mono text-[12px]">{location.origin}/v1</code>
				</div>
			</header>

			<div className="rounded-lg border border-line bg-white">
				<Table>
					<THead>
						<TR>
							<TH>Key</TH>
							<TH>Name</TH>
							<TH>Created</TH>
							<TH>Last used</TH>
							<TH>Status</TH>
							<TH className="text-right">Actions</TH>
						</TR>
					</THead>
					<TBody>
						{isLoading && (
							<TR>
								<TD colSpan={6} className="py-8 text-center text-sm text-ink-2">
									Đang tải…
								</TD>
							</TR>
						)}
						{(data?.keys ?? []).map((k) => (
							<TR key={k.id}>
								<TD className="font-mono text-[13px]">
									{k.prefix}
									<span className="text-ink-2">{"•".repeat(12)}</span>
								</TD>
								<TD>{k.name}</TD>
								<TD className="font-mono text-[12px] text-ink-2">{fmtDate(k.createdAt)}</TD>
								<TD className="font-mono text-[12px] text-ink-2">{fmtDate(k.lastUsedAt)}</TD>
								<TD>
									{k.active ? (
										<Badge className="border-[#bcd9c0] text-[#1d7a33]">ACTIVE</Badge>
									) : (
										<Badge className="border-[#e5bfc4] text-[#c6293b]">REVOKED</Badge>
									)}
								</TD>
								<TD>
									<div className="flex justify-end gap-2">
										<Button size="sm" variant="outline" disabled={!k.active} onClick={() => setConfirmRotate(k.id)}>
											<RotateCcw /> Rotate
										</Button>
										<Button size="sm" variant="ghost" disabled={!k.active} onClick={() => revoke.mutate(k.id)}>
											<Ban /> Revoke
										</Button>
									</div>
								</TD>
							</TR>
						))}
						{!isLoading && (data?.keys.length ?? 0) === 0 && (
							<TR>
								<TD colSpan={6} className="py-10 text-center text-sm text-ink-2">
									Chưa có key nào — admin sẽ tạo cho bạn.
								</TD>
							</TR>
						)}
					</TBody>
				</Table>
			</div>

			{/* confirm rotate */}
			<Dialog open={confirmRotate !== null} onOpenChange={(o) => !o && setConfirmRotate(null)}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Rotate API key?</DialogTitle>
						<DialogDescription>Key hiện tại sẽ bị thu hồi ngay lập tức và thay bằng key mới. Mọi harness đang dùng key cũ sẽ mất truy cập cho tới khi bạn cập nhật key mới.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirmRotate(null)}>
							Hủy
						</Button>
						<Button onClick={() => confirmRotate && rotate.mutate(confirmRotate)}>Rotate ngay</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* new key reveal */}
			<Dialog open={newKey !== null} onOpenChange={(o) => !o && setNewKey(null)}>
				<DialogContent className="max-w-xl">
					<DialogHeader>
						<DialogTitle>Key mới của bạn</DialogTitle>
						<DialogDescription>Chỉ hiển thị đúng 1 lần. Copy và lưu vào harness ngay.</DialogDescription>
					</DialogHeader>
					<div className="flex items-center gap-2 rounded-md border border-line bg-paper-2 p-3">
						<code className="flex-1 break-all font-mono text-[13px]">{newKey}</code>
						<Button
							size="icon"
							variant="secondary"
							onClick={() => {
								void navigator.clipboard.writeText(newKey ?? "");
								toast.success("Đã copy");
							}}
						>
							<Copy />
						</Button>
					</div>
					<DialogFooter>
						<Button onClick={() => setNewKey(null)}>Tôi đã lưu rồi</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
