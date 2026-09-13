import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@web/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-accent/40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
	{
		variants: {
			variant: {
				default: "bg-accent text-white hover:bg-[#1b1bc4] active:scale-[0.98]",
				secondary: "bg-navy text-white hover:bg-navy-3 active:scale-[0.98]",
				outline: "border border-line bg-white text-ink hover:bg-paper-2",
				ghost: "text-ink hover:bg-paper-2",
				destructive: "bg-[#c6293b] text-white hover:bg-[#a91f30]",
				link: "text-accent underline-offset-4 hover:underline",
			},
			size: {
				default: "h-9 px-4 rounded-md",
				sm: "h-8 px-3 rounded-sm text-[13px]",
				lg: "h-11 px-6 rounded-md",
				icon: "h-9 w-9 rounded-md",
			},
		},
		defaultVariants: { variant: "default", size: "default" },
	},
);

function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "button";
	return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { Button, buttonVariants };
