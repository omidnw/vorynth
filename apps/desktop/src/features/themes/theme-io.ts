import type { PluginTheme } from "@vorynth/types";

/**
 * Theme JSON import/export + AI-customization (v1.8.0).
 *
 * Vorynth themes are plain JSON: a `light` and a `dark` map of `--color-*`
 * tokens (each value an "r g b" triplet — Tailwind consumes them as
 * `rgb(var(--color-x) / <alpha>)`), plus an optional `icon` (Material Symbols
 * name) and `background` canvas override. That shape is exactly what plugin
 * themes ship, so an exported theme can be re-imported, shared, or handed to
 * an AI with the template below and pasted straight back through Import.
 */

export type ThemeParseResult =
	{ ok: true; theme: PluginTheme } | { ok: false; error: string };

const RESERVED_IDS = ["light", "dark"];
/** `--color-*` tokens MUST be "r g b" triplets (Tailwind's rgb(var()/alpha)). */
const TRIPLET = /^\d{1,3}( \d{1,3}){2}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Validate + normalize a raw theme JSON string. */
export function parseThemeJson(text: string): ThemeParseResult {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, error: "settings.themeErrorInvalidJson" };
	}
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		return { ok: false, error: "settings.themeErrorNotObject" };
	}
	const o = raw as Record<string, unknown>;

	const id = o.id;
	if (typeof id !== "string" || !SLUG.test(id)) {
		return { ok: false, error: "settings.themeErrorBadId" };
	}
	if (RESERVED_IDS.includes(id)) {
		return { ok: false, error: "settings.themeErrorReservedId" };
	}
	if (typeof o.name !== "string" || o.name.trim().length === 0) {
		return { ok: false, error: "settings.themeErrorBadName" };
	}

	const light = tokenMap(o.light);
	if (light.ok === false) return light;
	const dark = tokenMap(o.dark);
	if (dark.ok === false) return dark;
	if (
		Object.keys(light.map).length === 0 &&
		Object.keys(dark.map).length === 0
	) {
		return { ok: false, error: "settings.themeErrorNoTokens" };
	}

	if (o.icon !== undefined && typeof o.icon !== "string") {
		return { ok: false, error: "settings.themeErrorBadIcon" };
	}
	if (o.background !== undefined) {
		if (
			typeof o.background !== "object" ||
			o.background === null ||
			Array.isArray(o.background)
		) {
			return { ok: false, error: "settings.themeErrorBadBackground" };
		}
		const bg = o.background as Record<string, unknown>;
		if (
			(bg.light !== undefined && typeof bg.light !== "string") ||
			(bg.dark !== undefined && typeof bg.dark !== "string")
		) {
			return { ok: false, error: "settings.themeErrorBadBackground" };
		}
	}

	return {
		ok: true,
		theme: {
			id,
			name: o.name,
			light: light.map,
			dark: dark.map,
			...(typeof o.icon === "string" ? { icon: o.icon } : {}),
			...(o.background !== undefined
				? { background: o.background as PluginTheme["background"] }
				: {}),
		},
	};
}

function tokenMap(
	value: unknown,
): { ok: true; map: Record<string, string> } | { ok: false; error: string } {
	if (value === undefined) return { ok: true, map: {} };
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return { ok: false, error: "settings.themeErrorBadTokens" };
	}
	const map: Record<string, string> = {};
	for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
		if (typeof v !== "string" || v.trim().length === 0) {
			return { ok: false, error: "settings.themeErrorBadTokenValue" };
		}
		// Color tokens must be "r g b" triplets; non-color vars accept anything.
		if (k.startsWith("--color-") && !TRIPLET.test(v.trim())) {
			return { ok: false, error: "settings.themeErrorBadTriplet" };
		}
		map[k] = v.trim();
	}
	return { ok: true, map };
}

/** Pretty-printed JSON for a theme (the export file / AI input). */
export function themeToJson(theme: PluginTheme): string {
	return JSON.stringify(theme, null, 2);
}

/** Download a theme as `<id>.json`. */
export function downloadThemeJson(theme: PluginTheme): void {
	const blob = new Blob([themeToJson(theme)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${theme.id}.json`;
	a.click();
	URL.revokeObjectURL(url);
}

/**
 * Capture the currently APPLIED color tokens from the DOM into a theme file.
 * Built-in themes ("light"/"dark") have no registry entry, so this is how they
 * become exportable — the starting point for the AI-customize flow. Both
 * `light` and `dark` maps are seeded with the current mode's values; the AI is
 * told to differentiate them.
 */
export function themeFromDom(id: string, name: string): PluginTheme | null {
	if (typeof document === "undefined") return null;
	const cs = getComputedStyle(document.documentElement);
	const tokens: Record<string, string> = {};
	for (let i = 0; i < cs.length; i++) {
		const prop = cs[i];
		if (!prop || !prop.startsWith("--color-")) continue;
		const value = cs.getPropertyValue(prop).trim();
		if (value) tokens[prop] = value;
	}
	if (Object.keys(tokens).length === 0) return null;
	return { id, name, light: { ...tokens }, dark: { ...tokens } };
}

/**
 * The ready-to-paste prompt for customizing a theme with an LLM. The active
 * theme's JSON (from `themeToJson`) is appended by the caller.
 */
export function themeAiPrompt(themeJson: string): string {
	return `You are customizing the theme of a desktop app called Vorynth.

Here is the app's current theme as JSON:
\`\`\`json
${themeJson}
\`\`\`

The format:
- "id": a lowercase slug (letters, digits, dashes). Do NOT use "light" or "dark".
- "name": a display name.
- "light" and "dark": maps of CSS variable → "r g b" triplet (three numbers 0-255, no alpha). "light" is the light mode palette, "dark" the dark mode palette. Keep the SAME variable keys as the input — change only the color values. Vary the whole palette so the theme is cohesive: primary, secondary, background, surface tiers, on-* text colors, outline, error, warning, tertiary, etc.
- Optional "icon": a Material Symbols name (e.g. "solar_power", "forest").
- Optional "background": { "light": "...", "dark": "..." } — a CSS background for the canvas (a gradient or image url is fine).

Create a beautiful, coherent theme with a clear personality. Keep every variable from the input; feel free to add more --color-* variables if the palette needs them. Reply with ONLY the JSON — no explanation, no markdown fence around it.`;
}
