import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPlugins, patchPlugin } from "@/features/plugins/plugins-api";
import {
	usePluginContributions,
	pluginDocsSections,
	pluginStoryExports,
	allPluginNavItems,
	type ResolvedNavItem,
} from "@/plugins/plugin-contributions.js";
import type { DocsSection, PluginInfo } from "@vorynth/types";

/**
 * Plugin hooks (v1.9.0) — shared by the app and the plugin host surface.
 *
 * Enabled state + per-plugin configuration come from the engine's plugin list
 * (`GET /plugins`), the single source of truth. The PluginHostProvider installs
 * an equivalent `usePluginConfig` into `window.__VORYNTH_HOST__` for runtime
 * bundles; this module is the app-side counterpart.
 */

/** All plugins with enabled state (react-query, cached). */
export function usePlugins(): PluginInfo[] | undefined {
	const { data } = useQuery({
		queryKey: ["plugins"],
		queryFn: fetchPlugins,
		staleTime: 30_000,
	});
	return data;
}

/** Map of plugin id → effectiveEnabled, for contribution consumers. */
export function usePluginsEnabled(): Record<string, boolean> {
	const plugins = usePlugins();
	const map: Record<string, boolean> = {};
	for (const p of plugins ?? []) map[p.id] = p.effectiveEnabled;
	return map;
}

/**
 * Read/update a plugin's persisted configuration. `update` shallow-merges a
 * patch into `plugins.configuration` (the engine's PATCH /plugins/:id) and
 * invalidates the plugin list so every consumer sees the new value.
 */
export function usePluginConfig(pluginId: string): {
	config: Record<string, unknown>;
	update: (patch: Record<string, unknown>) => Promise<void>;
} {
	const queryClient = useQueryClient();
	const plugins = usePlugins();
	const info = plugins?.find((p) => p.id === pluginId);
	return {
		config: info?.configuration ?? {},
		update: async (patch) => {
			await patchPlugin(pluginId, { configuration: patch });
			await queryClient.invalidateQueries({ queryKey: ["plugins"] });
		},
	};
}

/**
 * Nav items contributed by enabled runtime UI plugins. Subscribes to the
 * contribution store so the sidebar picks up plugins as they load (fixes the
 * flaky nav item that appeared or not depending on load-order races).
 */
export function usePluginNavItems(): ResolvedNavItem[] {
	usePluginContributions();
	return allPluginNavItems();
}

/**
 * Docs sections contributed by enabled runtime UI plugins. Subscribes to the
 * contribution store so the Docs page + sidebar pick up plugins as they load.
 */
export function usePluginDocsSections(): DocsSection[] {
	// Subscribe to the store so a late-loading plugin re-renders consumers.
	usePluginContributions();
	return pluginDocsSections();
}

/**
 * Story export panels contributed by enabled runtime UI plugins (v1.8.0) — the
 * Article reader's Export dialog renders these. Subscribes to the contribution
 * store so the export button appears as plugins finish loading.
 */
export function usePluginStoryExports() {
	usePluginContributions();
	return pluginStoryExports();
}
