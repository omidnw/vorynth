import { create } from "zustand";
import type {
	FontCatalog,
	FontFamilyInfo,
	IconSetData,
	PluginFontFace,
	SvgIconEntry,
} from "@vorynth/types";

/**
 * Offline asset registry (v1.8.0 — Icon Pack plugin).
 *
 * Runtime UI plugins register icon sets and fonts here through the plugin SDK;
 * the `Icon` component renders inline SVG from the registered sets and falls
 * back to the Material Symbols ligature when a set/name is missing. Font faces
 * registered via `registerFont` are injected into a `<style>` so plugins can
 * ship their own `@font-face` rules; the Icon Pack's bulk catalog (for the
 * gallery) lands via `registerFontCatalog`.
 *
 * Nothing here fetches the network — the data is build-generated into
 * `public/plugins/icons/` and fetched by the icons plugin itself.
 */

interface AssetRegistryState {
	/** Registered icon sets keyed by set id ("lucide", "fa-solid", …). */
	iconSets: Record<string, IconSetData>;
	/** Individually registered `@font-face` rules (plugin-owned fonts). */
	fontFaces: PluginFontFace[];
	/** Font catalog families (what's offline — surfaced by the gallery). */
	fonts: FontFamilyInfo[];
	/** Bumped on every registration — drives reactivity via `useAssetRegistry`. */
	version: number;
	registerIconSet: (setId: string, data: IconSetData) => void;
	registerFont: (font: PluginFontFace) => void;
	registerFontCatalog: (catalog: FontCatalog) => void;
	clear: () => void;
}

/** `<style>` id that holds plugin-registered `@font-face` rules. */
const FONT_STYLE_ID = "vorynth-registered-fonts";

function injectFontFace(font: PluginFontFace) {
	if (typeof document === "undefined") return;
	let el = document.getElementById(FONT_STYLE_ID) as HTMLStyleElement | null;
	if (!el) {
		el = document.createElement("style");
		el.id = FONT_STYLE_ID;
		document.head.appendChild(el);
	}
	const weight = font.weight ? `font-weight: ${font.weight};` : "";
	const style = font.style ? `font-style: ${font.style};` : "";
	el.textContent += `@font-face { font-family: '${font.family}'; ${weight} ${style} src: url('${font.src}') format('woff2'); }\n`;
}

/** Dedupe key — one face per (family, weight, style, src). */
function faceKey(font: PluginFontFace): string {
	return `${font.family}|${font.weight ?? ""}|${font.style ?? ""}|${font.src}`;
}

export const useAssetRegistry = create<AssetRegistryState>((set, get) => ({
	iconSets: {},
	fontFaces: [],
	fonts: [],
	version: 0,
	registerIconSet: (setId, data) =>
		set((s) => ({
			iconSets: { ...s.iconSets, [setId]: data },
			version: s.version + 1,
		})),
	registerFont: (font) => {
		if (get().fontFaces.some((f) => faceKey(f) === faceKey(font))) return;
		injectFontFace(font);
		set((s) => ({
			fontFaces: [...s.fontFaces, font],
			version: s.version + 1,
		}));
	},
	registerFontCatalog: (catalog) =>
		set((s) => ({
			fonts: catalog.families,
			version: s.version + 1,
		})),
	clear: () => set({ iconSets: {}, fontFaces: [], fonts: [], version: 0 }),
}));

/** Icon entry lookup — the icon itself, or undefined when set/name missing. */
export function iconEntry(
	setId: string,
	name: string,
): { set: IconSetData; entry: SvgIconEntry } | undefined {
	const set = useAssetRegistry.getState().iconSets[setId];
	const entry = set?.icons[name];
	return set && entry ? { set, entry } : undefined;
}

/** All registered sets as { id, count } — for galleries and docs. */
export function iconSetSummaries(): { id: string; count: number }[] {
	const state = useAssetRegistry.getState();
	return Object.entries(state.iconSets)
		.map(([id, set]) => ({ id, count: Object.keys(set.icons).length }))
		.sort((a, b) => a.id.localeCompare(b.id));
}

/** Offline font families registered by the Icon Pack (for the gallery). */
export function availableFonts(): FontFamilyInfo[] {
	return useAssetRegistry.getState().fonts;
}
