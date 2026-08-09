import { create } from "zustand";
import type {
	DocsSection,
	ExportableContent,
	PluginBundleExports,
	PluginNavItem,
	PluginTheme,
} from "@vorynth/types";
import type { ComponentType } from "react";

/**
 * Plugin contribution store (v1.9.0) — aggregates what runtime UI plugins
 * contribute to the app: nav items, settings sections, docs sections, themes.
 *
 * PluginHostProvider loads the bundles for ENABLED `kind:"ui"` plugins and
 * registers their exports here; consumers (sidebar, Settings, Docs page, theme
 * store) read the aggregated lists. Nothing here executes plugin code — that
 * already happened at load time; this store only carries the results.
 */

export interface LoadedUiPlugin {
	id: string;
	name: string;
	version: string;
	exports: PluginBundleExports;
}

interface PluginContributionsState {
	/** Loaded UI plugins keyed by plugin id. */
	loaded: Record<string, LoadedUiPlugin>;
	register: (plugin: LoadedUiPlugin) => void;
	/** Drop one plugin's contributions (disable/uninstall). */
	unregister: (id: string) => void;
	clear: () => void;
}

export const usePluginContributions = create<PluginContributionsState>(
	(set) => ({
		loaded: {},
		register: (plugin) =>
			set((s) => ({ loaded: { ...s.loaded, [plugin.id]: plugin } })),
		unregister: (id) =>
			set((s) => {
				if (!(id in s.loaded)) return s;
				const loaded = { ...s.loaded };
				delete loaded[id];
				return { loaded };
			}),
		clear: () => set({ loaded: {} }),
	}),
);

/** A nav item with its owning plugin id resolved (for routing). */
export interface ResolvedNavItem extends PluginNavItem {
	pluginId: string;
}

/** All nav items from loaded UI plugins, in plugin order, tagged by plugin. */
export function allPluginNavItems(): ResolvedNavItem[] {
	return Object.values(usePluginContributions.getState().loaded).flatMap((p) =>
		(p.exports.navItems ?? []).map((item) => ({
			...item,
			pluginId: p.id,
		})),
	);
}

/** Settings-section components (keyed by plugin id, render order stable). */
export function pluginSettingsSections(): {
	pluginId: string;
	name: string;
	Component: ComponentType<{ pluginId: string }>;
}[] {
	return Object.values(usePluginContributions.getState().loaded)
		.filter((p) => typeof p.exports.SettingsSection === "function")
		.map((p) => ({
			pluginId: p.id,
			name: p.name,
			Component: p.exports.SettingsSection as ComponentType<{
				pluginId: string;
			}>,
		}));
}

/** Docs sections contributed by loaded UI plugins. */
export function pluginDocsSections(): DocsSection[] {
	return Object.values(usePluginContributions.getState().loaded)
		.map((p) => p.exports.docsSection)
		.filter((s): s is DocsSection => Boolean(s));
}

/** Themes contributed by loaded UI plugins. */
export function pluginThemes(): PluginTheme[] {
	return Object.values(usePluginContributions.getState().loaded).flatMap(
		(p) => p.exports.themes ?? [],
	);
}

/**
 * Export panels contributed by loaded UI plugins (v1.8.0). Any page with
 * exportable content (article reader, insight, search/Ask-AI answer, history
 * entry, period briefing) renders them inside its Export dialog; a component
 * receives the generic `ExportableContent` plus an `onClose` that dismisses
 * the dialog. The Story Renderer core plugin is the reference implementation.
 */
export function pluginStoryExports(): {
	pluginId: string;
	Component: ComponentType<{ content: ExportableContent; onClose: () => void }>;
}[] {
	return Object.values(usePluginContributions.getState().loaded)
		.filter((p) => typeof p.exports.StoryExports === "function")
		.map((p) => ({
			pluginId: p.id,
			Component: p.exports.StoryExports as ComponentType<{
				content: ExportableContent;
				onClose: () => void;
			}>,
		}));
}

/** A loaded plugin by id (undefined when not loaded / disabled). */
export function loadedPlugin(id: string): LoadedUiPlugin | undefined {
	return usePluginContributions.getState().loaded[id];
}
