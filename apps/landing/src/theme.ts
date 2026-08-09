import { useCallback, useSyncExternalStore } from "react";

const KEY = "vorynth-theme";
const DARK_META = "#0E1513";
const LIGHT_META = "#F8FAFA";

export type Theme = "dark" | "light";

function systemPrefersDark(): boolean {
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStored(): Theme | null {
	try {
		const v = localStorage.getItem(KEY);
		if (v === "dark" || v === "light") return v;
	} catch {
		/* storage blocked — fall through */
	}
	return null;
}

/**
 * Module-level theme singleton. EVERY `useTheme()` consumer (the nav toggle,
 * the preview bridge) sees the same state and any toggle updates them all —
 * so the preview's theme and the page's theme can never disagree. The `dark`
 * class on <html> flips the shared theme.css tokens.
 */
let current: Theme = readStored() ?? (systemPrefersDark() ? "dark" : "light");
const listeners = new Set<() => void>();

function apply(theme: Theme): void {
	current = theme;
	document.documentElement.classList.toggle("dark", theme === "dark");
	document.documentElement.classList.toggle("light", theme === "light");
	const meta = document.getElementById("theme-color") as HTMLMetaElement | null;
	if (meta) meta.content = theme === "dark" ? DARK_META : LIGHT_META;
	try {
		localStorage.setItem(KEY, theme);
	} catch {
		/* storage blocked — the class still applies for this session */
	}
	for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Follow the OS theme only when the user hasn't saved their own choice. */
window
	.matchMedia("(prefers-color-scheme: dark)")
	.addEventListener("change", (e) => {
		try {
			if (localStorage.getItem(KEY) === null)
				apply(e.matches ? "dark" : "light");
		} catch {
			/* ignore */
		}
	});

export function useTheme() {
	const theme = useSyncExternalStore(subscribe, () => current);
	const setTheme = useCallback((t: Theme) => apply(t), []);
	const toggle = useCallback(
		() => apply(current === "dark" ? "light" : "dark"),
		[],
	);
	return { theme, toggle, setTheme };
}
