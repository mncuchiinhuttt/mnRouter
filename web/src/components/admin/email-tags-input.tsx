import { useState, useRef, type KeyboardEvent, type ClipboardEvent } from "react";
import { X, Mail, Users, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface EmailTagsInputProps {
	emails: string[];
	onChange: (emails: string[]) => void;
	placeholder?: string;
	disabled?: boolean;
	id?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailTagsInput({
	emails,
	onChange,
	placeholder = "Type email and press Enter...",
	disabled = false,
	id,
}: EmailTagsInputProps) {
	const [inputValue, setInputValue] = useState("");
	const [inputError, setInputError] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const addEmail = (raw: string): boolean => {
		const clean = raw.trim().toLowerCase();
		if (!clean) return false;

		if (!EMAIL_REGEX.test(clean)) {
			setInputError(true);
			toast.error(`Invalid email format: "${clean}"`);
			return false;
		}

		if (emails.includes(clean)) {
			toast.info(`Email "${clean}" is already added.`);
			return false;
		}

		onChange([...emails, clean]);
		setInputError(false);
		return true;
	};

	const removeEmail = (index: number) => {
		onChange(emails.filter((_, i) => i !== index));
	};

	const clearAll = () => {
		onChange([]);
		setInputValue("");
		setInputError(false);
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === "," || e.key === "Tab" || (e.key === " " && inputValue.includes("@"))) {
			if (inputValue.trim()) {
				e.preventDefault();
				if (addEmail(inputValue)) {
					setInputValue("");
				}
			}
		} else if (e.key === "Backspace" && !inputValue && emails.length > 0) {
			e.preventDefault();
			removeEmail(emails.length - 1);
		}
	};

	const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
		e.preventDefault();
		const pasted = e.clipboardData.getData("text");
		if (!pasted) return;

		// Split by comma, semicolon, space, newline
		const candidates = pasted
			.split(/[\s,;]+/)
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean);

		if (candidates.length === 0) return;

		const valid: string[] = [];
		const invalid: string[] = [];

		for (const c of candidates) {
			if (EMAIL_REGEX.test(c)) {
				if (!emails.includes(c) && !valid.includes(c)) {
					valid.push(c);
				}
			} else {
				invalid.push(c);
			}
		}

		if (valid.length > 0) {
			onChange([...emails, ...valid]);
			setInputValue("");
			toast.success(`Added ${valid.length} email${valid.length > 1 ? "s" : ""}`);
		}

		if (invalid.length > 0) {
			toast.error(`Skipped ${invalid.length} invalid email(s)`);
		}
	};

	return (
		<div className="space-y-1.5">
			<div
				onClick={() => inputRef.current?.focus()}
				className={`flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-md border bg-white p-1.5 transition cursor-text ${
					inputError
						? "border-red-500 ring-1 ring-red-500"
						: "border-line focus-within:border-accent focus-within:ring-1 focus-within:ring-accent"
				} ${disabled ? "opacity-60 pointer-events-none" : ""}`}
			>
				{/* Email Tags */}
				{emails.map((email, idx) => (
					<span
						key={email}
						className="inline-flex items-center gap-1 rounded bg-paper-2 px-2 py-0.5 font-mono text-xs font-medium text-ink border border-line animate-in fade-in zoom-in-95 duration-150"
					>
						<Mail className="size-3 text-ink-2/70 shrink-0" />
						<span>{email}</span>
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								removeEmail(idx);
							}}
							className="ml-0.5 rounded p-0.5 text-ink-2 hover:bg-black/5 hover:text-ink transition cursor-pointer"
							aria-label={`Remove ${email}`}
						>
							<X className="size-3" />
						</button>
					</span>
				))}

				{/* Inline Input */}
				<input
					ref={inputRef}
					id={id}
					type="text"
					disabled={disabled}
					value={inputValue}
					onChange={(e) => {
						setInputValue(e.target.value);
						if (inputError) setInputError(false);
					}}
					onKeyDown={handleKeyDown}
					onPaste={handlePaste}
					onBlur={() => {
						if (inputValue.trim()) {
							if (addEmail(inputValue)) {
								setInputValue("");
							}
						}
					}}
					placeholder={emails.length === 0 ? placeholder : "Add more..."}
					className="min-w-[160px] flex-1 bg-transparent px-1.5 py-0.5 font-mono text-xs text-ink placeholder:text-ink-2/50 focus:outline-none"
				/>
			</div>

			{/* Sub-label info & batch counter */}
			<div className="flex items-center justify-between text-[11px] font-mono text-ink-2/70 px-0.5">
				<div className="flex items-center gap-1.5">
					<Users className="size-3 text-accent" />
					<span>
						{emails.length === 0 ? (
							"Type email and press Enter, or paste list (comma / newline)"
						) : (
							<strong className="text-ink font-semibold">
								{emails.length} recipient{emails.length > 1 ? "s" : ""} selected
							</strong>
						)}
					</span>
				</div>

				{emails.length > 0 && (
					<button
						type="button"
						onClick={clearAll}
						className="text-ink-2 hover:text-red-600 transition underline cursor-pointer"
					>
						Clear all
					</button>
				)}
			</div>
		</div>
	);
}
