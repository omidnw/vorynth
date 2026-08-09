import { describe, expect, it } from "vitest";
import * as sdk from "./host-bridge.js";

/**
 * Plugin SDK contract (v1.8.0 security hardening) — `@vorynth/plugin-host` is
 * aliased to host-bridge.ts for every plugin bundle, so the SDK's export
 * surface IS the plugin's capability boundary. The raw engine API client
 * (`apiFetch`) was removed from the host surface; a plugin's only engine
 * access is its own persisted configuration via `usePluginConfig`. This test
 * locks that boundary in place so it can't silently regress.
 */
describe("plugin SDK — narrowed host surface (v1.8.0)", () => {
	it("does not expose a raw engine API client", () => {
		// The old SDK shipped `apiFetch(path, init)` here — a plugin could call
		// ANY engine endpoint (delete sources, wipe backups, …). It must stay gone.
		expect(sdk).not.toHaveProperty("apiFetch");
	});

	it("keeps the documented SDK surface a plugin needs", () => {
		// Navigation + i18n (host-provided).
		expect(sdk.navigate).toBeTypeOf("function");
		expect(sdk.useTranslation).toBeTypeOf("function");
		// The plugin's own persisted config is its only engine access.
		expect(sdk.usePluginConfig).toBeTypeOf("function");
		// Offline Icon Pack SDK (asset registry).
		expect(sdk.registerIconSet).toBeTypeOf("function");
		expect(sdk.registerFont).toBeTypeOf("function");
		expect(sdk.registerFontCatalog).toBeTypeOf("function");
		expect(sdk.useAssetRegistry).toBeTypeOf("function");
		expect(sdk.useAvailableFonts).toBeTypeOf("function");
		// React pieces re-exported so plugin JSX keeps uniform imports.
		expect(sdk.createElement).toBeTypeOf("function");
		expect(sdk.Fragment).toBeDefined();
		expect(sdk.Icon).toBeTypeOf("function");
	});
});
