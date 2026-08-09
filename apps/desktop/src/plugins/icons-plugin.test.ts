import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { iconEntry, useAssetRegistry } from "./asset-registry.js";
import type { VorynthPluginHost } from "./host/host-types.js";

/**
 * Icon Pack plugin registration (v1.8.0) — importing the bundle must fetch the
 * build-generated data files and register them into the asset registry through
 * the SDK (registerIconSet / registerFontCatalog), plus inject the offline
 * @font-face css. The host surface is stubbed to the real registry, mirroring
 * what PluginHostProvider installs.
 */
describe("icons plugin — offline asset registration", () => {
	beforeEach(() => {
		useAssetRegistry.getState().clear();
		document.getElementById("vorynth-icons-fonts")?.remove();
		window.__VORYNTH_HOST__ = installHost();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		delete window.__VORYNTH_HOST__;
	});

	it("registers the three icon sets, the font catalog, and the css on load", async () => {
		vi.stubGlobal("fetch", stubFetch);
		window.__VORYNTH_HOST__ = installHost();

		await import("../../plugins/icons/src/index.tsx");

		// Registration is async (fire-and-forget at module load) — wait for it.
		await vi.waitFor(() => {
			expect(iconEntry("lucide", "home")?.entry.e).toHaveLength(1);
		});
		expect(iconEntry("fa-solid", "house")?.set.mode).toBe("fill");
		expect(iconEntry("fa-brands", "github")).toBeDefined();
		expect(useAssetRegistry.getState().fonts[0]?.family).toBe("Inter");

		// The offline @font-face rules landed in the document (async after the
		// sets — the css fetch follows the Promise.all that registers them).
		await vi.waitFor(() => {
			const style = document.getElementById("vorynth-icons-fonts");
			expect(style).not.toBeNull();
			expect(style?.textContent).toContain("@font-face");
			expect(style?.textContent).toContain("inter-400.woff2");
		});
	});
});

/** Host surface wired to the real asset registry (like PluginHostProvider). */
function installHost(): VorynthPluginHost {
	const snapshot = () => {
		const s = useAssetRegistry.getState();
		return {
			version: s.version,
			iconEntry: (setId: string, name: string) => iconEntry(setId, name)?.entry,
			iconSet: (setId: string) => s.iconSets[setId],
			iconSets: s.iconSets,
			fonts: s.fonts,
		};
	};
	return {
		React: {} as never,
		ReactDOM: {} as never,
		useTranslation: () => ({ t: (k: string) => k }),
		navigate: () => undefined,
		usePluginConfig: () => ({ config: {}, update: async () => undefined }),
		useAssetRegistry: snapshot,
		registerIconSet: (setId, data) =>
			useAssetRegistry.getState().registerIconSet(setId, data),
		registerFont: (font) => useAssetRegistry.getState().registerFont(font),
		registerFontCatalog: (catalog) =>
			useAssetRegistry.getState().registerFontCatalog(catalog),
	};
}

/** Minimal stand-ins for the build-generated data files. */
function stubFetch(url: RequestInfo | URL): Promise<Response> {
	const u = String(url);
	const json = (body: unknown) =>
		Promise.resolve(
			new Response(JSON.stringify(body), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
	if (u.endsWith("icons.lucide.json"))
		return json({
			mode: "stroke",
			v: "0 0 24 24",
			icons: { home: { e: [["path", { d: "M3 10a2 2 0 0 1 .7-1.5" }]] } },
		});
	if (u.endsWith("icons.fa-solid.json"))
		return json({
			mode: "fill",
			icons: {
				house: { v: "0 0 512 512", e: [["path", { d: "M277.8 8.6" }]] },
			},
		});
	if (u.endsWith("icons.fa-brands.json"))
		return json({
			mode: "fill",
			icons: { github: { v: "0 0 512 512", e: [["path", { d: "M1 1" }]] } },
		});
	if (u.endsWith("fonts/fonts.json"))
		return json({
			families: [
				{
					family: "Inter",
					script: "latin",
					weights: ["400"],
					styles: ["normal"],
					sample: "The quick brown fox",
				},
			],
		});
	if (u.endsWith("fonts/fonts.css"))
		return Promise.resolve(
			new Response(
				"@font-face { font-family: 'Inter'; src: url('/plugins/icons/fonts/inter-400.woff2') format('woff2'); }",
				{ status: 200 },
			),
		);
	return Promise.resolve(new Response("not found", { status: 404 }));
}
