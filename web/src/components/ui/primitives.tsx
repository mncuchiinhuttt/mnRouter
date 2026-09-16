import * as React from "react";
import { cn } from "@web/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("rounded-lg border border-line bg-white", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("flex flex-col gap-1 px-5 pt-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
	return <h3 className={cn("font-semibold tracking-tight text-ink", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("px-5 pb-5 pt-3", className)} {...props} />;
}

export function Badge({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"label-mono inline-flex items-center rounded-xs border border-line px-1.5 py-0.5 text-[10px] text-ink-2",
				className,
			)}
			{...props}
		/>
	);
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			className={cn(
				"h-9 w-full rounded-sm border border-line bg-white px-3 text-sm text-ink outline-none transition placeholder:text-[#9d9d94] focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			className={cn(
				"min-h-[80px] w-full rounded-sm border border-line bg-white px-3 py-2 text-sm outline-none transition placeholder:text-[#9d9d94] focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 font-mono",
				className,
			)}
			{...props}
		/>
	);
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
	return <label className={cn("label-mono block text-ink-2", className)} {...props} />;
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
	return (
		<div className="w-full overflow-x-auto">
			<table className={cn("w-full min-w-[680px] caption-bottom text-sm", className)} {...props} />
		</div>
	);
}

export function THead({ className, ...props }: React.ComponentProps<"thead">) {
	return <thead className={cn("bg-paper/70 [&_tr]:border-b [&_tr]:border-line", className)} {...props} />;
}

export function TBody({ className, ...props }: React.ComponentProps<"tbody">) {
	return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TR({ className, ...props }: React.ComponentProps<"tr">) {
	return <tr className={cn("border-b border-line transition-colors hover:bg-paper-2/60", className)} {...props} />;
}

export function TH({ className, ...props }: React.ComponentProps<"th">) {
	return <th className={cn("label-mono h-11 whitespace-nowrap px-4 text-left align-middle font-medium text-ink-2", className)} {...props} />;
}

export function TD({ className, ...props }: React.ComponentProps<"td">) {
	return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}

export function Separator({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("h-px w-full bg-line", className)} {...props} />;
}
