import { create } from "zustand";

/**
 * Theme store — light/dark toggle persisted to localStorage.
 *
 * Both palettes are defined for day one (examples/colors/vorynth-{light,dark}.md);
 * flipping this store adds/removes `.dark` on <html>. No component edits needed.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "vorynth.theme";

function getInitialTheme(): Theme {
	if (typeof window === "undefined") return "light";
	const stored = window.localStorage.getItem(STORAGE_KEY);
	if (stored === "light" || stored === "dark") return stored;
	const prefersDark = window.matchMedia?.(
		"(prefers-color-scheme: dark)",
	).matches;
	return prefersDark ? "dark" : "light";
}

interface ThemeState {
	theme: Theme;
	setTheme: (t: Theme) => void;
	toggle: () => void;
}

function applyTheme(theme: Theme) {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.classList.toggle("dark", theme === "dark");
	root.classList.toggle("light", theme === "light");
}

export const useThemeStore = create<ThemeState>((set, get) => ({
	theme: getInitialTheme(),
	setTheme: (theme) => {
		if (typeof window !== "undefined")
			window.localStorage.setItem(STORAGE_KEY, theme);
		applyTheme(theme);
		set({ theme });
	},
	toggle: () => {
		const next = get().theme === "light" ? "dark" : "light";
		get().setTheme(next);
	},
}));

/** Call once at app startup to sync the <html> class with the persisted theme. */
export function initTheme() {
	applyTheme(useThemeStore.getState().theme);
}
