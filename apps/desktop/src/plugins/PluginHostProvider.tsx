import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { CORE_BASE_URL } from "@/lib/api/config";
import { fetchPlugins } from "@/features/plugins/plugins-api";
import {
	registerPluginTheme,
	unregisterPluginTheme,
} from "@/lib/theme/theme-store.js";
import { clearPluginCache, loadPluginBundle } from "./plugin-loader.js";
import { usePluginContributions } from "./plugin-contributions.js";
import { usePluginConfig } from "./plugin-hooks.js";
import {
	useAssetRegistry as assetRegistry,
	iconEntry,
} from "./asset-registry.js";

/**
 * PluginHostProvider — installs the runtime host surface and loads UI plugins.
 *
 * v1.9.0 runtime code plugins: after mounting (inside the Router + QueryClient
 * providers, so plugins get working navigate() and API hooks), the provider:
 *
 *  1. Places `window.__VORYNTH_HOST__` — React, ReactDOM, i18n, the router,
 *     a per-plugin config hook, and the offline asset registry (Icon Pack
 *     icons/fonts). The raw engine API client is NOT exposed: plugins get a
 *     narrowed SDK surface so they can't reach engine endpoints that manage
 *     sources, archives, or backups (v1.8.0 security hardening).
 *  2. Fetches the plugin list from the engine and loads the bundle of every
 *     ENABLED `kind:"ui"` plugin via blob-import. Installed plugins fetch their
 *     bundle from the engine (`GET /plugins/:id/bundle`); built-ins use the
 *     static `/plugins/<id>/bundle.js` path.
 *  3. Registers each bundle's contributions (nav items, settings section, docs
 *     section, themes) into the contribution store, and UNREGISTERS plugins
 *     that stopped being enabled (disabled or uninstalled) — dropping their
 *     contributions, themes, and cached bundle.
 *
 * Plugins are trusted first-party code for now (built-ins ship with the app);
 * the enable/disable toggle is the control surface.
 */
export function PluginHostProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const { t } = useTranslation();

	// Reactive view of the offline asset registry, surfaced to plugin bundles.
	const useAssetRegistryHost = () => {
		useSyncExternalStore(
			assetRegistry.subscribe,
			() => assetRegistry.getState().version,
			() => assetRegistry.getState().version,
		);
		const state = assetRegistry.getState();
		return {
			version: state.version,
			iconEntry: (setId: string, name: string) => iconEntry(setId, name)?.entry,
			iconSet: (setId: string) => state.iconSets[setId],
			iconSets: state.iconSets,
			fonts: state.fonts,
		};
	};

	const { data: plugins } = useQuery({
		queryKey: ["plugins"],
		queryFn: fetchPlugins,
		staleTime: 30_000,
	});

	useEffect(() => {
		// ── 1. Install the host surface ────────────────────────────────
		// The surface is the plugin SDK: React, i18n, navigation, the plugin's
		// own persisted config, and the offline asset registry. The raw engine
		// API client is deliberately absent (v1.8.0 security hardening) — a
		// plugin must not reach engine endpoints that manage data; its only
		// engine access is usePluginConfig (scoped to its own id).
		window.__VORYNTH_HOST__ = {
			React,
			ReactDOM,
			useTranslation: () => ({ t }),
			navigate,
			usePluginConfig,
			useAssetRegistry: useAssetRegistryHost,
			registerIconSet: (setId, data) =>
				assetRegistry.getState().registerIconSet(setId, data),
			registerFont: (font) => assetRegistry.getState().registerFont(font),
			registerFontCatalog: (catalog) =>
				assetRegistry.getState().registerFontCatalog(catalog),
		};
		window.__VORYNTH_HOST_READY__ = true;
	}, [navigate, t]);

	useEffect(() => {
		// ── 2 + 3. Load enabled UI plugins, unregister stale ones ──────
		const uiPlugins =
			plugins?.filter((p) => p.kind === "ui" && p.effectiveEnabled) ?? [];

		const { unregister, loaded } = usePluginContributions.getState();

		// Drop plugins that were loaded but are no longer enabled (disabled or
		// uninstalled): their contributions, themes, and cached bundle go too.
		for (const id of Object.keys(loaded)) {
			if (!uiPlugins.some((p) => p.id === id)) {
				const exports = loaded[id]?.exports;
				for (const theme of exports?.themes ?? []) {
					unregisterPluginTheme(theme.id);
				}
				unregister(id);
				clearPluginCache(id);
			}
		}

		if (uiPlugins.length === 0) return;

		let cancelled = false;
		const registerFn = usePluginContributions.getState().register;
		(async () => {
			for (const plugin of uiPlugins) {
				if (cancelled) return;
				// Already loaded → nothing to do.
				if (usePluginContributions.getState().loaded[plugin.id]) continue;
				const bundleUrl = plugin.installed
					? `${CORE_BASE_URL}/plugins/${encodeURIComponent(plugin.id)}/bundle`
					: undefined;
				const exports = await loadPluginBundle(plugin.id, bundleUrl);
				if (cancelled || !exports) continue;
				registerFn({
					id: plugin.id,
					name: plugin.name,
					version: plugin.version,
					exports,
				});
				// Register contributed themes so they're selectable/applicable.
				for (const theme of exports.themes ?? []) {
					registerPluginTheme(theme);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [plugins]);

	return <>{children}</>;
}
