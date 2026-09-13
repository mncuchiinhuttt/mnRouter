import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@web/lib/utils";

const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
	return <TabsPrimitive.List className={cn("inline-flex items-center gap-1 rounded-md border border-line bg-white p-1", className)} {...props} />;
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
	return (
		<TabsPrimitive.Trigger
			className={cn(
				"label-mono inline-flex items-center justify-center rounded-xs px-3 py-1.5 text-ink-2 transition data-[state=active]:bg-navy data-[state=active]:text-white cursor-pointer",
				className,
			)}
			{...props}
		/>
	);
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
	return <TabsPrimitive.Content className={cn("mt-4 outline-none", className)} {...props} />;
}

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
	return (
		<SwitchPrimitive.Root
			className={cn(
				"peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-line transition-colors data-[state=checked]:bg-accent data-[state=unchecked]:bg-paper-2",
				className,
			)}
			{...props}
		>
			<SwitchPrimitive.Thumb className="pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-[2px]" />
		</SwitchPrimitive.Root>
	);
}

export { Tabs, TabsList, TabsTrigger, TabsContent, Switch };
