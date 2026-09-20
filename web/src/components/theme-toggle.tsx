import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
	const [theme, setTheme] = useState<"light" | "dark">("light");

	useEffect(() => {
		const saved = localStorage.getItem("mn_theme");
		if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
			setTheme("dark");
			document.documentElement.classList.add("dark");
		} else {
			setTheme("light");
			document.documentElement.classList.remove("dark");
		}
	}, []);

	const toggleTheme = () => {
		const next = theme === "light" ? "dark" : "light";
		setTheme(next);
		localStorage.setItem("mn_theme", next);
		if (next === "dark") {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	};

	return (
		<button
			type="button"
			onClick={toggleTheme}
			className="inline-flex size-8 items-center justify-center rounded-md border border-line/70 bg-surface text-ink-2 hover:text-ink hover:border-line transition cursor-pointer"
			title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
			aria-label="Toggle Theme"
		>
			{theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4 text-[#f59e0b]" />}
		</button>
	);
}
