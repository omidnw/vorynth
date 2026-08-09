/**
 * Window host typing — what PluginHostProvider places on `window.__VORYNTH_HOST__`
 * for runtime plugin bundles to consume through the host shims.
 */
import type * as React from "react";
import type * as ReactDOM from "react-dom";
import type {
	FontCatalog,
	FontFamilyInfo,
	IconSetData,
	PluginFontFace,
	SvgIconEntry,
} from "@vorynth/types";

export interface PluginConfigHandle {
	/** Current persisted configuration (plugins.configuration JSON). */
	config: Record<string, unknown>;
	/** Shallow-merge a patch into the persisted configuration. */
	update: (patch: Record<string, unknown>) => Promise<void>;
}

/** Reactive view of the offline asset registry (Icon Pack + plugin fonts). */
export interface AssetRegistrySnapshot {
	/** Bumped on every registration — subscribe to re-render. */
	version: number;
	/** The icon entry for (set, name), or undefined when missing. */
	iconEntry: (setId: string, name: string) => SvgIconEntry | undefined;
	/** The whole registered set, or undefined when not registered. */
	iconSet: (setId: string) => IconSetData | undefined;
	/** All registered sets, keyed by set id (replaced on every registration). */
	iconSets: Record<string, IconSetData>;
	/** Offline font families (the Icon Pack catalog). */
	fonts: FontFamilyInfo[];
}

/** The runtime host surface exposed to plugin bundles. */
export interface VorynthPluginHost {
	React: typeof React;
	ReactDOM: typeof ReactDOM;
	/** i18n hook from the app (react-i18next). */
	useTranslation: () => {
		t: (key: string, opts?: Record<string, unknown>) => string;
	};
	// NOTE: the raw engine API client is deliberately NOT exposed to plugins
	// (v1.8.0 security hardening). Plugin bundles must not reach engine
	// endpoints that manage sources, archives, or backups; the only engine
	// access is the plugin's own persisted configuration via usePluginConfig.
	/** react-router navigation. */
	navigate: (to: string) => void;
	/** Read/update a plugin's persisted configuration. */
	usePluginConfig: (pluginId: string) => PluginConfigHandle;
	/** Reactive offline asset registry (Icon Pack / plugin fonts & icons). */
	useAssetRegistry: () => AssetRegistrySnapshot;
	/** Register an offline icon set (Icon Pack SDK). */
	registerIconSet: (setId: string, data: IconSetData) => void;
	/** Register + inject a single `@font-face` (Icon Pack SDK). */
	registerFont: (font: PluginFontFace) => void;
	/** Register the Icon Pack's font catalog (gallery metadata). */
	registerFontCatalog: (catalog: FontCatalog) => void;
}

declare global {
	interface Window {
		__VORYNTH_HOST__?: VorynthPluginHost;
		/** Set by PluginHostProvider once the host surface is installed. */
		__VORYNTH_HOST_READY__?: boolean;
	}
}

export {};
