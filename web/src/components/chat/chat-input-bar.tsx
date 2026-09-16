import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Paperclip, Send, Square, X } from "lucide-react";
import { Button } from "@web/components/ui/button";
import { fmtCompact } from "@web/lib/utils";

export interface AttachedFile {
	id: string;
	filename: string;
	sizeBytes: number;
}

export interface ChatInputBarProps {
	input: string;
	onInputChange: (val: string) => void;
	onSend: () => void;
	isStreaming: boolean;
	uploading: boolean;
	onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
	attachedFiles: AttachedFile[];
	onRemoveFile: (id: string) => void;
}

export function ChatInputBar({
	input,
	onInputChange,
	onSend,
	isStreaming,
	uploading,
	onUpload,
	onPaste,
	attachedFiles,
	onRemoveFile,
}: ChatInputBarProps) {
	const { t } = useTranslation();
	const fileInputRef = useRef<HTMLInputElement>(null);

	return (
		<div className="space-y-2">
			{attachedFiles.length > 0 && (
				<div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-1.5 px-1">
					<span className="font-mono text-[10px] uppercase tracking-wider text-ink-2 mr-0.5">Uploaded:</span>
					{attachedFiles.map((f) => (
						<div key={f.id} className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-mono border border-line shadow-2xs">
							<FileText className="size-3.5 text-accent shrink-0" />
							<span className="truncate max-w-[200px] font-medium text-ink">{f.filename}</span>
							<span className="text-ink-2 text-[10.5px]">({fmtCompact(f.sizeBytes)}B)</span>
							<span className="text-[9.5px] text-[#1d7a33] bg-[#f4faf5] px-1 py-0.2 rounded border border-[#bcd9c0]">24h</span>
							<button
								type="button"
								onClick={() => onRemoveFile(f.id)}
								className="text-ink-2 hover:text-[#c6293b] cursor-pointer p-0.5 rounded hover:bg-paper-2 transition ml-0.5"
								title="Xoá file khỏi server"
							>
								<X className="size-3" />
							</button>
						</div>
					))}
				</div>
			)}

			<div className="mx-auto flex w-full max-w-4xl items-center gap-2 rounded-xl border border-line bg-white px-3 py-1.5 shadow-xs focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition">
				<input ref={fileInputRef} type="file" className="hidden" onChange={onUpload} />
				<Button
					type="button"
					size="sm"
					variant="ghost"
					className="h-8 w-8 p-0 text-ink-2 hover:text-ink cursor-pointer shrink-0 rounded-lg"
					title={t("chat.uploadLimit")}
					disabled={uploading}
					onClick={() => fileInputRef.current?.click()}
				>
					<Paperclip className="size-4" />
				</Button>
				<textarea
					value={input}
					rows={1}
					onPaste={onPaste}
					onChange={(e) => onInputChange(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							onSend();
						}
					}}
					placeholder={t("chat.placeholder")}
					className="flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed focus:outline-none placeholder:text-ink-2/60"
				/>
				<Button
					size="sm"
					className="h-8 w-8 p-0 shrink-0 rounded-lg"
					disabled={(!input.trim() && attachedFiles.length === 0) || isStreaming}
					onClick={onSend}
				>
					{isStreaming ? <Square className="size-3.5 fill-current" /> : <Send className="size-3.5" />}
				</Button>
			</div>
			<div className="text-center">
				<span className="font-mono text-[10.5px] text-ink-2/60">{t("chat.uploadLimit")}</span>
			</div>
		</div>
	);
}
