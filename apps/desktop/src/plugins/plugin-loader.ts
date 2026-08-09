import type { PluginBundleExports } from "@vorynth/types";

/**
 * Runtime plugin loader (v1.9.0 — runtime code plugins).
 *
 * Fetches a plugin's compiled bundle (`public/plugins/<id>/bundle.js`, produced
 * by `scripts/build-plugin-bundles.mjs`), wraps it in a Blob URL, and dynamic-
 * imports it. Blob-import avoids Vite/Turbopack static analysis of the bundle,
 * and each module is cached per plugin id (singleton). Loads only what the
 * host says is installed + enabled; a missing or broken bundle degrades to null
 * instead of breaking the app.
 *
 * The bundle is self-contained EXCEPT React, react-dom, and the app APIs, which
 * it pulls from `window.__VORYNTH_HOST__` through the host shims — so plugin
 * code shares one React instance with the app (no duplicate copies, no broken
 * context/hooks).
 */

const moduleCache = new Map<string, PluginBundleExports | null>();

/** Drop a cached module (e.g. after a plugin upgrade/reload). */
export function clearPluginCache(pluginId?: string): void {
	if (pluginId) moduleCache.delete(pluginId);
	else moduleCache.clear();
}

/**
 * Real dynamic import for runtime-resolved URLs.
 *
 * Deliberately created through `new Function` (not a literal `import(url)`):
 * Vite's dev import-analysis rewrites every non-static `import(...)` into
 * `import(__vite__injectQuery(url, 'import'))`, which appends `?import` to the
 * URL. That corrupts blob: URLs (a blob is registered under its exact URL, so
 * `blob:…?import` can't resolve) and breaks plugin loading in dev. The
 * `@vite-ignore` comment only suppresses the warning — the rewrite still
 * happens. Building the import at runtime hides it from Vite's static
 * analysis entirely.
 */
const dynamicImport = new Function("url", "return import(url)") as (
	url: string,
) => Promise<unknown>;

/**
 * The dynamic-import step. Overridable so tests can stub the module import
 * (node's vitest runner can't import blob: URLs).
 */
let importImpl: (url: string) => Promise<unknown> = dynamicImport;

/** Test hook — replace the import implementation. */
export function __setImportImpl(fn: (url: string) => Promise<unknown>): void {
	importImpl = fn;
}

/**
 * Load a plugin's bundle as an ES module. Returns null when the plugin isn't
 * built, can't be fetched, or fails to import — never throws to the caller.
 *
 * @param pluginId the plugin's id (cache key + default bundle URL).
 * @param bundleUrl optional override — installed plugins fetch their bundle
 *   from the engine (`GET /plugins/:id/bundle`); built-ins use the default
 *   static path (`/plugins/<id>/bundle.js`).
 */
export async function loadPluginBundle(
	pluginId: string,
	bundleUrl?: string,
): Promise<PluginBundleExports | null> {
	const cached = moduleCache.get(pluginId);
	if (cached !== undefined) return cached;

	try {
		const fetchUrl =
			bundleUrl ?? `/plugins/${encodeURIComponent(pluginId)}/bundle.js`;
		const res = await fetch(fetchUrl);
		if (!res.ok) {
			console.warn(`[plugin-loader] ${pluginId}: HTTP ${res.status}`);
			moduleCache.set(pluginId, null);
			return null;
		}
		const code = await res.text();
		const blob = new Blob([code], { type: "text/javascript" });
		const url = URL.createObjectURL(blob);
		try {
			const mod = (await importImpl(url)) as PluginBundleExports;
			moduleCache.set(pluginId, mod);
			return mod;
		} finally {
			URL.revokeObjectURL(url);
		}
	} catch (err) {
		console.warn(`[plugin-loader] ${pluginId} failed to load:`, err); // nosemgrep: unsafe-formatstring — template literal with pluginId, no user-controlled format specifiers
		moduleCache.set(pluginId, null);
		return null;
	}
}
