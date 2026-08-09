import { beforeEach, describe, expect, it } from "vitest";
import {
	availableFonts,
	iconEntry,
	iconSetSummaries,
	useAssetRegistry,
} from "./asset-registry.js";

/**
 * Offline asset registry (v1.8.0 — Icon Pack plugin). The registry is a plain
 * zustand store: icon sets + fonts register via the SDK and read back through
 * `iconEntry`/`availableFonts`. Font-face injection writes to a `<style>`.
 */
describe("asset registry — offline icon sets + fonts", () => {
	beforeEach(() => {
		useAssetRegistry.getState().clear();
		document.getElementById("vorynth-registered-fonts")?.remove();
	});

	it("registers an icon set and looks up entries", () => {
		useAssetRegistry.getState().registerIconSet("lucide", {
			mode: "stroke",
			v: "0 0 24 24",
			icons: {
				home: {
					e: [
						["path", { d: "M3 10a2 2 0 0 1 .709-1.528l7-6" }],
						["path", { d: "M21 12v7a2 2 0 0 1-2 2h-4v-7" }],
					],
				},
			},
		});

		expect(iconEntry("lucide", "home")?.entry.e).toHaveLength(2);
		expect(iconEntry("lucide", "home")?.set.mode).toBe("stroke");
		// Missing set or name → undefined (the SDK falls back to Material).
		expect(iconEntry("lucide", "nope")).toBeUndefined();
		expect(iconEntry("ghost-set", "home")).toBeUndefined();
	});

	it("summarizes registered sets with counts", () => {
		useAssetRegistry.getState().registerIconSet("lucide", {
			mode: "stroke",
			v: "0 0 24 24",
			icons: { home: { e: [["path", { d: "M3 10" }]] }, user: { e: [] } },
		});
		useAssetRegistry.getState().registerIconSet("fa-solid", {
			mode: "fill",
			icons: { house: { v: "0 0 512 512", e: [] } },
		});

		expect(iconSetSummaries()).toEqual([
			{ id: "fa-solid", count: 1 },
			{ id: "lucide", count: 2 },
		]);
	});

	it("registers a font catalog and serves it through availableFonts()", () => {
		useAssetRegistry.getState().registerFontCatalog({
			families: [
				{
					family: "Inter",
					script: "latin",
					weights: ["400", "700"],
					styles: ["normal"],
					sample: "The quick brown fox",
				},
			],
		});
		expect(availableFonts()).toHaveLength(1);
		expect(availableFonts()[0]?.family).toBe("Inter");
	});

	it("registerFont injects an @font-face rule and dedupes", () => {
		const face = {
			family: "Inter",
			weight: "400",
			src: "/plugins/icons/fonts/inter-400.woff2",
		};
		useAssetRegistry.getState().registerFont(face);
		useAssetRegistry.getState().registerFont(face);

		const style = document.getElementById("vorynth-registered-fonts");
		expect(style).not.toBeNull();
		expect(style?.textContent).toContain("@font-face");
		expect(style?.textContent).toContain("font-family: 'Inter'");
		expect(style?.textContent).toContain("inter-400.woff2");
		// Deduped — exactly one face registered despite two calls.
		expect(useAssetRegistry.getState().fontFaces).toHaveLength(1);
	});

	it("bumps the version on every registration (drives useAssetRegistry)", () => {
		const v0 = useAssetRegistry.getState().version;
		useAssetRegistry.getState().registerIconSet("lucide", {
			mode: "stroke",
			v: "0 0 24 24",
			icons: {},
		});
		expect(useAssetRegistry.getState().version).toBe(v0 + 1);
	});
});
