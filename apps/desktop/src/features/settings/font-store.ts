import { create } from "zustand";
import { useAssetRegistry } from "@/plugins/asset-registry.js";

/**
 * Font customization (v1.8.0) — the Settings → Appearance font picker + size
 * slider + custom-font import.
 *
 * Applies by injecting a small `<style>` that overrides the `--font-*` /
 * `--font-scale` variables globals.css defines (Tailwind consumes them), so a
 * single override re-skins the whole app. Persisted in localStorage like the
 * theme. Custom fonts are registered through the same `registerFont` path the
 * Icon Pack uses (injects the @font-face), then selected as the body font.
 */

const STYLE_ID = "vorynth-user-fonts";
const FAMILY_KEY = "vorynth.fontFamily";
const SCALE_KEY = "vorynth.fontScale";

export const FONT_SCALE_MIN = 0.85;
export const FONT_SCALE_MAX = 1.3;
export const FONT_SCALE_STEP = 0.05;

function readStored(): { family: string | null; scale: number } {
	if (typeof window === "undefined") return { family: null, scale: 1 };
	const family = window.localStorage.getItem(FAMILY_KEY) || null;
	const raw = window.localStorage.getItem(SCALE_KEY);
	const scale = raw ? Number(raw) : 1;
	return { family, scale: Number.isFinite(scale) ? scale : 1 };
}

interface FontState {
	family: string | null;
	scale: number;
	setFamily: (family: string | null) => void;
	setScale: (scale: number) => void;
	reset: () => void;
}

function apply(family: string | null, scale: number) {
	if (typeof document === "undefined") return;
	let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
	const overrides: string[] = [];
	if (family)
		overrides.push(`--font-body: ${family}, ui-sans-serif, sans-serif;`);
	if (scale !== 1) overrides.push(`--font-scale: ${scale};`);
	if (overrides.length === 0) {
		el?.remove();
		return;
	}
	if (!el) {
		el = document.createElement("style");
		el.id = STYLE_ID;
		document.head.appendChild(el);
	}
	el.textContent = `:root { ${overrides.join(" ")} }`;
}

export const useFontStore = create<FontState>((set, get) => {
	const stored = readStored();
	apply(stored.family, stored.scale);
	return {
		family: stored.family,
		scale: stored.scale,
		setFamily: (family) => {
			if (typeof window !== "undefined") {
				if (family) window.localStorage.setItem(FAMILY_KEY, family);
				else window.localStorage.removeItem(FAMILY_KEY);
			}
			apply(family, get().scale);
			set({ family });
		},
		setScale: (scale) => {
			const clamped = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, scale));
			if (typeof window !== "undefined")
				window.localStorage.setItem(SCALE_KEY, String(clamped));
			apply(get().family, clamped);
			set({ scale: clamped });
		},
		reset: () => {
			if (typeof window !== "undefined") {
				window.localStorage.removeItem(FAMILY_KEY);
				window.localStorage.removeItem(SCALE_KEY);
			}
			apply(null, 1);
			set({ family: null, scale: 1 });
		},
	};
});

/**
 * Register a user-picked .woff2 font file so it becomes selectable. Registered
 * through the same store the Icon Pack uses (injects the @font-face), so the
 * family works fully offline once selected.
 */
export async function importCustomFont(file: File): Promise<string> {
	if (!file.name.toLowerCase().endsWith(".woff2")) {
		throw new Error("woff2-only");
	}
	const family = file.name.replace(/\.[a-z0-9]+$/i, "").trim() || "Custom font";
	const dataUrl = await fileToDataUrl(file);
	useAssetRegistry.getState().registerFont({ family, src: dataUrl });
	return family;
}

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}
