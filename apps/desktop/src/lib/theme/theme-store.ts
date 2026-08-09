import { create } from "zustand";
import type { PluginTheme } from "@vorynth/types";

/**
 * Theme store — the active theme id, persisted to localStorage.
 *
 * v1.8.0: generalized from a strict light/dark union to arbitrary theme ids.
 * Built-ins "light" and "dark" keep their static CSS blocks in theme.css (the
 * `.light`/`.dark` classes + initial-paint path are unchanged). Plugin themes
 * register token maps; applying one sets `data-theme="<id>"` on
 * `<html>` and injects a scoped `<style>` block so the plugin palette overrides
 * the built-in tokens by specificity. The existing `.dark` class still flips
 * dark mode inside any theme. Themes can also carry an identity `icon` (shown
 * in the toggle/picker) and a canvas `background` (gradient/image).
 */

export type Theme = string;

const STORAGE_KEY = "vorynth.theme";
/** User-imported themes (v1.8.0) — same shape as plugin themes, persisted. */
const USER_THEMES_KEY = "vorynth.userThemes";
const BUILT_IN: readonly string[] = ["light", "dark"];

/** Registry of registered plugin themes (id → palette). */
const pluginThemeRegistry = new Map<string, PluginTheme>();
/** Registry of user-imported themes (id → palette). */
const userThemeRegistry = new Map<string, PluginTheme>();

/** Load persisted user themes synchronously (before the store initializes). */
function loadUserThemes(): void {
	if (typeof window === "undefined") return;
	try {
		const raw = window.localStorage.getItem(USER_THEMES_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return;
		for (const t of parsed) {
			if (
				t &&
				typeof t === "object" &&
				typeof (t as PluginTheme).id === "string"
			) {
				userThemeRegistry.set((t as PluginTheme).id, t as PluginTheme);
			}
		}
	} catch {
		// Corrupt stored themes — start clean rather than crash the app.
	}
}

loadUserThemes();

/** Persist the user-theme registry to localStorage. */
function persistUserThemes(): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(
		USER_THEMES_KEY,
		JSON.stringify([...userThemeRegistry.values()]),
	);
}

/** Resolve a theme's palette from plugin + user registries (built-ins have
 *  their static CSS blocks in theme.css and are absent here). */
function findTheme(id: string): PluginTheme | undefined {
	return pluginThemeRegistry.get(id) ?? userThemeRegistry.get(id);
}

function getInitialTheme(): Theme {
	if (typeof window === "undefined") return "light";
	const stored = window.localStorage.getItem(STORAGE_KEY);
	if (stored && BUILT_IN.includes(stored)) return stored;
	if (stored && findTheme(stored)) return stored;
	const prefersDark = window.matchMedia?.(
		"(prefers-color-scheme: dark)",
	).matches;
	return prefersDark ? "dark" : "light";
}

interface ThemeState {
	theme: Theme;
	setTheme: (t: Theme) => void;
	toggle: () => void;
	/**
	 * Bumped every time a plugin theme registers — lets pickers that read
	 * `availableThemes()` re-render when a plugin loads after first paint.
	 */
	registryVersion: number;
}

function applyTheme(theme: Theme) {
	if (typeof document === "undefined") return;
	const root = document.documentElement;

	// Always stamp the theme id; built-ins also toggle their static class so
	// the CSS blocks in theme.css keep working exactly as before.
	root.setAttribute("data-theme", theme);
	if (theme === "dark") {
		root.classList.add("dark");
		root.classList.remove("light");
	} else if (theme === "light") {
		root.classList.add("light");
		root.classList.remove("dark");
	}

	injectPluginTheme(theme);
}

/**
 * Inject (or clear) the `<style>` block for a plugin theme. Built-ins have no
 * injected block — their tokens live in theme.css. Plugin rules are scoped to
 * `:root[data-theme="<id>"]` (+ `.dark` variant), which beats the built-in
 * `.light`/`.dark` classes by specificity while letting the `.dark` mode class
 * keep working.
 */
function injectPluginTheme(theme: Theme) {
	const palette = findTheme(theme);
	const styleId = "vorynth-plugin-theme";
	let el = document.getElementById(styleId) as HTMLStyleElement | null;

	const hasTokens =
		palette &&
		((palette.light && Object.keys(palette.light).length > 0) ||
			(palette.dark && Object.keys(palette.dark).length > 0) ||
			Boolean(palette.background?.light || palette.background?.dark));
	if (!hasTokens) {
		el?.remove();
		return;
	}

	if (!el) {
		el = document.createElement("style");
		el.id = styleId;
		document.head.appendChild(el);
	}
	const tokens = (map: Record<string, string>) =>
		Object.entries(map)
			.map(([k, v]) => `${k}: ${v};`)
			.join(" ");
	const rules: string[] = [];
	if (palette?.light && Object.keys(palette.light).length > 0) {
		rules.push(`:root[data-theme="${theme}"] { ${tokens(palette.light)} }`);
	}
	if (palette?.dark && Object.keys(palette.dark).length > 0) {
		rules.push(`:root[data-theme="${theme}"].dark { ${tokens(palette.dark)} }`);
	}
	// Canvas background — the escape hatch for gradients/images. Flat colors
	// flow through the token maps above; `background` overrides the canvas.
	if (palette?.background?.light) {
		rules.push(
			`:root[data-theme="${theme}"] .vorynth-canvas { background: ${palette.background.light}; }`,
		);
	}
	if (palette?.background?.dark) {
		rules.push(
			`:root[data-theme="${theme}"].dark .vorynth-canvas { background: ${palette.background.dark}; }`,
		);
	}
	el.textContent = rules.join("\n");
}

export const useThemeStore = create<ThemeState>((set, get) => ({
	theme: getInitialTheme(),
	registryVersion: 0,
	setTheme: (theme) => {
		if (typeof window !== "undefined")
			window.localStorage.setItem(STORAGE_KEY, theme);
		applyTheme(theme);
		set({ theme });
	},
	toggle: () => {
		const current = get().theme;
		// Built-in themes toggle between each other; plugin themes keep their
		// palette and just flip the dark-mode class (their palette has both
		// light and dark token sets).
		const next =
			current === "light" ? "dark" : current === "dark" ? "light" : current;
		if (next === current) {
			document.documentElement.classList.toggle("dark");
			document.documentElement.classList.toggle("light");
		}
		get().setTheme(next);
	},
}));

/** Register a plugin theme so it becomes selectable + applicable. */
export function registerPluginTheme(theme: PluginTheme): void {
	pluginThemeRegistry.set(theme.id, theme);
	// If this theme is already active (user had it selected), re-apply so the
	// palette appears now that its tokens are available.
	if (useThemeStore.getState().theme === theme.id) {
		applyTheme(theme.id);
	}
	// Notify pickers subscribed to `registryVersion`.
	useThemeStore.setState((s) => ({ registryVersion: s.registryVersion + 1 }));
}

/**
 * Remove a plugin theme (plugin disabled/uninstalled). If the removed theme was
 * active, fall back to the persisted theme or light.
 */
export function unregisterPluginTheme(id: string): void {
	if (!pluginThemeRegistry.has(id)) return;
	pluginThemeRegistry.delete(id);
	const { theme } = useThemeStore.getState();
	if (theme === id) {
		const fallback = getInitialTheme();
		if (typeof window !== "undefined")
			window.localStorage.setItem(STORAGE_KEY, fallback);
		applyTheme(fallback);
		useThemeStore.setState({ theme: fallback });
	}
	useThemeStore.setState((s) => ({ registryVersion: s.registryVersion + 1 }));
}

/** The current theme id if it's a plugin theme, else null. */
export function isPluginTheme(id: string): boolean {
	return pluginThemeRegistry.has(id);
}

/** All selectable themes: built-ins first, then plugin + user themes. */
export function availableThemes(): {
	id: string;
	name: string;
	icon?: string;
}[] {
	const builtIn = [
		{ id: "light", name: "Light", icon: "light_mode" },
		{ id: "dark", name: "Dark", icon: "dark_mode" },
	];
	const custom = [
		...pluginThemeRegistry.values(),
		...userThemeRegistry.values(),
	].map((t) => ({ id: t.id, name: t.name, icon: t.icon }));
	return [...builtIn, ...custom];
}

/**
 * The identity icon for a theme id (the theme's own icon for plugin themes,
 * the sun/moon for built-ins) — used by the shell toggle.
 */
export function currentThemeIcon(theme: Theme): string {
	if (theme === "light") return "light_mode";
	if (theme === "dark") return "dark_mode";
	return findTheme(theme)?.icon ?? "light_mode";
}

/** Full palette definition for a theme id (built-ins return null — their
 *  tokens live in static CSS). Used for export. */
export function getThemeDefinition(id: Theme): PluginTheme | null {
	return findTheme(id) ?? null;
}

/** The user-imported themes (for the manager UI: Edit / Export / Delete). */
export function userThemes(): PluginTheme[] {
	return [...userThemeRegistry.values()];
}

/** Is `id` a user-imported theme (as opposed to plugin/built-in)? */
export function isUserTheme(id: string): boolean {
	return userThemeRegistry.has(id);
}

/** Register (or replace) a user theme and persist it. Rejects reserved ids. */
export function registerUserTheme(theme: PluginTheme): void {
	if (BUILT_IN.includes(theme.id)) {
		throw new Error(`cannot use reserved theme id "${theme.id}"`);
	}
	userThemeRegistry.set(theme.id, theme);
	persistUserThemes();
	if (useThemeStore.getState().theme === theme.id) {
		applyTheme(theme.id);
	}
	useThemeStore.setState((s) => ({ registryVersion: s.registryVersion + 1 }));
}

/** Remove a user theme. If it was active, fall back like a disabled plugin. */
export function unregisterUserTheme(id: string): void {
	if (!userThemeRegistry.has(id)) return;
	userThemeRegistry.delete(id);
	persistUserThemes();
	const { theme } = useThemeStore.getState();
	if (theme === id) {
		const fallback = getInitialTheme();
		if (typeof window !== "undefined")
			window.localStorage.setItem(STORAGE_KEY, fallback);
		applyTheme(fallback);
		useThemeStore.setState({ theme: fallback });
	}
	useThemeStore.setState((s) => ({ registryVersion: s.registryVersion + 1 }));
}

/** Call once at app startup to sync the <html> class with the persisted theme. */
export function initTheme() {
	applyTheme(useThemeStore.getState().theme);
}

/**
 * Is dark mode active right now? Built-in "dark" theme, or the `.dark` class
 * on a plugin theme. Read live from the DOM so it's correct for every theme.
 */
export function isDarkMode(): boolean {
	if (typeof document === "undefined") return false;
	return (
		document.documentElement.classList.contains("dark") ||
		useThemeStore.getState().theme === "dark"
	);
}
