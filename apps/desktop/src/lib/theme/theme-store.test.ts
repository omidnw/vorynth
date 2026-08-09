import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	availableThemes,
	currentThemeIcon,
	initTheme,
	isDarkMode,
	registerPluginTheme,
	unregisterPluginTheme,
	useThemeStore,
} from "@/lib/theme/theme-store.js";

/**
 * Theme store (v1.9.0) — generalized from a light/dark union to arbitrary
 * theme ids with plugin palette injection. jsdom provides document/localStorage.
 */
describe("theme store — plugin themes", () => {
	const storage = new Map<string, string>();

	beforeEach(() => {
		storage.clear();
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(
			(k: string) => storage.get(k) ?? null,
		);
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(
			(k: string, v: string) => storage.set(k, v),
		);
		document.documentElement.removeAttribute("data-theme");
		document.documentElement.className = "";
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("registers a plugin theme and makes it selectable", () => {
		registerPluginTheme({
			id: "solar-flare",
			name: "Solar Flare",
			light: { "--color-primary": "196 84 20" },
			dark: { "--color-primary": "255 184 135" },
		});

		const themes = availableThemes();
		expect(themes.map((t) => t.id)).toEqual(["light", "dark", "solar-flare"]);
		expect(themes[2]?.name).toBe("Solar Flare");
	});

	it("bumps the registry revision so pickers re-render on late registration", () => {
		const before = useThemeStore.getState().registryVersion;
		registerPluginTheme({
			id: "solar-flare",
			name: "Solar Flare",
			light: {},
			dark: {},
		});
		expect(useThemeStore.getState().registryVersion).toBe(before + 1);
	});

	it("applying a plugin theme stamps data-theme and injects a scoped <style>", () => {
		registerPluginTheme({
			id: "solar-flare",
			name: "Solar Flare",
			light: { "--color-primary": "196 84 20" },
			dark: { "--color-primary": "255 184 135" },
		});
		useThemeStore.getState().setTheme("solar-flare");

		expect(document.documentElement.getAttribute("data-theme")).toBe(
			"solar-flare",
		);
		const style = document.getElementById("vorynth-plugin-theme");
		expect(style).not.toBeNull();
		expect(style?.textContent).toContain(':root[data-theme="solar-flare"]');
		expect(style?.textContent).toContain("--color-primary: 196 84 20");
		expect(style?.textContent).toContain(".dark");
	});

	it("clears the injected <style> when a built-in theme is applied", () => {
		registerPluginTheme({
			id: "solar-flare",
			name: "Solar Flare",
			light: { "--color-primary": "196 84 20" },
			dark: { "--color-primary": "255 184 135" },
		});
		useThemeStore.getState().setTheme("solar-flare");
		expect(document.getElementById("vorynth-plugin-theme")).not.toBeNull();

		useThemeStore.getState().setTheme("light");
		expect(document.getElementById("vorynth-plugin-theme")).toBeNull();
		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
	});

	it("initTheme() falls back to light when a stored id isn't registered", () => {
		storage.set("vorynth.theme", "ghost-theme");
		initTheme();
		// Unregistered stored id → light (built-in fallback), no crash.
		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
	});

	it("isDarkMode() reads the .dark class on plugin themes", () => {
		registerPluginTheme({
			id: "solar-flare",
			name: "Solar Flare",
			light: {},
			dark: {},
		});
		useThemeStore.getState().setTheme("solar-flare");
		expect(isDarkMode()).toBe(false);
		document.documentElement.classList.add("dark");
		expect(isDarkMode()).toBe(true);
	});

	it("surfaces a plugin theme's identity icon in availableThemes()", () => {
		registerPluginTheme({
			id: "solar-flare",
			name: "Solar Flare",
			icon: "flare",
			light: {},
			dark: {},
		});
		const themes = availableThemes();
		// Built-ins carry their own sun/moon icons; the plugin theme its own.
		expect(themes[0]).toMatchObject({ id: "light", icon: "light_mode" });
		expect(themes[1]).toMatchObject({ id: "dark", icon: "dark_mode" });
		expect(themes[2]).toMatchObject({ id: "solar-flare", icon: "flare" });
	});

	it("currentThemeIcon() maps built-ins to sun/moon and plugins to their icon", () => {
		registerPluginTheme({
			id: "solar-flare",
			name: "Solar Flare",
			icon: "flare",
			light: {},
			dark: {},
		});
		expect(currentThemeIcon("light")).toBe("light_mode");
		expect(currentThemeIcon("dark")).toBe("dark_mode");
		expect(currentThemeIcon("solar-flare")).toBe("flare");
		// Unregistered theme id → sensible fallback.
		expect(currentThemeIcon("ghost")).toBe("light_mode");
	});

	it("injects a canvas background rule for plugin themes", () => {
		registerPluginTheme({
			id: "solar-flare",
			name: "Solar Flare",
			background: {
				light:
					"linear-gradient(180deg, rgb(255 243 233 / 0.6), rgb(252 227 208 / 0.4))",
				dark: "linear-gradient(180deg, rgb(48 36 27 / 0.55), rgb(59 46 36 / 0.45))",
			},
			light: {},
			dark: {},
		});
		useThemeStore.getState().setTheme("solar-flare");

		const style = document.getElementById("vorynth-plugin-theme");
		expect(style).not.toBeNull();
		expect(style?.textContent).toContain(
			':root[data-theme="solar-flare"] .vorynth-canvas',
		);
		expect(style?.textContent).toContain("rgb(255 243 233 / 0.6)");
		expect(style?.textContent).toContain(
			':root[data-theme="solar-flare"].dark .vorynth-canvas',
		);
	});

	it("unregisterPluginTheme() removes the theme from the picker", () => {
		registerPluginTheme({
			id: "solar-flare",
			name: "Solar Flare",
			light: {},
			dark: {},
		});
		expect(availableThemes().map((t) => t.id)).toContain("solar-flare");

		unregisterPluginTheme("solar-flare");
		expect(availableThemes().map((t) => t.id)).toEqual(["light", "dark"]);
		// Removing a theme the user is not on still bumps the revision so
		// pickers re-render.
		expect(useThemeStore.getState().registryVersion).toBeGreaterThan(0);
	});

	it("unregisterPluginTheme() falls back when the active theme is removed", () => {
		registerPluginTheme({
			id: "solar-flare",
			name: "Solar Flare",
			light: { "--color-primary": "196 84 20" },
			dark: { "--color-primary": "255 184 135" },
		});
		useThemeStore.getState().setTheme("solar-flare");
		expect(document.documentElement.getAttribute("data-theme")).toBe(
			"solar-flare",
		);

		unregisterPluginTheme("solar-flare");
		// The store + DOM fall back to a built-in theme, and the persisted
		// preference is rewritten so the next start doesn't reference a ghost.
		expect(useThemeStore.getState().theme).toBe("light");
		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
		expect(storage.get("vorynth.theme")).toBe("light");
	});

	it("unregisterPluginTheme() of an unknown id is a no-op", () => {
		unregisterPluginTheme("ghost");
		expect(availableThemes().map((t) => t.id)).toEqual(["light", "dark"]);
	});
});
