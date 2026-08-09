/**
 * Plugin SDK — what a plugin imports as `@vorynth/plugin-host`.
 *
 * This module is ALIASED into every plugin bundle at build time (esbuild
 * `alias: { "@vorynth/plugin-host": this file }`). It reads the host surface
 * (`window.__VORYNTH_HOST__`) that PluginHostProvider installs at runtime, so a
 * plugin gets the app's React, i18n, router, and its own persisted
 * configuration — without ever bundling the app.
 *
 * The SDK is deliberately narrow (v1.8.0 security hardening): there is no
 * generic engine API client. A plugin's only engine access is its own
 * persisted configuration via `usePluginConfig` (scoped to the plugin's id);
 * everything else comes from the host surface (navigation, i18n, asset
 * registry). This keeps an installed plugin from reaching engine endpoints
 * that manage sources, archives, or backups.
 *
 * Plugin source imports from this module; type-only re-exports let it write
 * typed contributions (docs sections, nav items, themes) against the shared
 * contract.
 */
import {
	createElement,
	Fragment,
	useCallback,
	useEffect,
	useState,
} from "react";
import type { ComponentType } from "react";
import type {
	DocsSection,
	FontCatalog,
	FontFamilyInfo,
	IconSetData,
	IconSetId,
	PluginBundleExports,
	PluginFontFace,
	PluginNavItem,
	PluginTheme,
	SvgIconEntry,
} from "@vorynth/types";
import type {
	AssetRegistrySnapshot,
	PluginConfigHandle,
} from "./host-types.js";

const host = window.__VORYNTH_HOST__;

function requireHost(): NonNullable<typeof host> {
	if (!host) {
		throw new Error(
			"@vorynth/plugin-host used before PluginHostProvider mounted",
		);
	}
	return host;
}

/** react-router navigation. */
export function navigate(to: string): void {
	requireHost().navigate(to);
}

/** App i18n hook. */
export function useTranslation() {
	return requireHost().useTranslation();
}

/**
 * Read + update this plugin's persisted configuration (plugins.configuration).
 * The hook is host-provided so it stays reactive to engine state.
 */
export function usePluginConfig(pluginId: string): PluginConfigHandle {
	return requireHost().usePluginConfig(pluginId);
}

/**
 * Type helpers so plugin source can build typed contributions. These are the
 * same shapes the host renders — no runtime cost (type-only).
 */
export type {
	DocsSection,
	PluginNavItem,
	PluginTheme,
	PluginBundleExports,
	// Offline Icon Pack SDK types (icon sets, fonts, registry snapshots).
	IconSetId,
	IconSetData,
	SvgIconEntry,
	PluginFontFace,
	FontCatalog,
	FontFamilyInfo,
	AssetRegistrySnapshot,
};

/** Convenience: a plugin's main view component type. */
export type PluginViewComponent = ComponentType<{
	pluginId: string;
}>;

// ── Offline Icon Pack SDK (v1.8.0) ──────────────────────────────────────────
// The Icon Pack core plugin registers icon sets + fonts into the app's asset
// registry. Any plugin can consume them with these SDK helpers — icon data and
// font files are served from `/plugins/icons/…` entirely offline.

/** Register an offline icon set ("lucide", "fa-solid", "fa-brands", …). */
export function registerIconSet(setId: string, data: IconSetData): void {
	requireHost().registerIconSet(setId, data);
}

/** Register + inject a single `@font-face` rule (plugin-owned fonts). */
export function registerFont(font: PluginFontFace): void {
	requireHost().registerFont(font);
}

/** Register the Icon Pack font catalog (families list for galleries/docs). */
export function registerFontCatalog(catalog: FontCatalog): void {
	requireHost().registerFontCatalog(catalog);
}

/** Offline font families registered by the Icon Pack — reactive. */
export function useAvailableFonts(): FontFamilyInfo[] {
	return requireHost().useAssetRegistry().fonts;
}

/** Reactive registry snapshot — icon sets + fonts with a version bump. */
export function useAssetRegistry(): AssetRegistrySnapshot {
	return requireHost().useAssetRegistry();
}

export interface SdkIconProps {
	/** The registered set to draw from ("lucide", "fa-solid", "fa-brands"). */
	set: string;
	/** Icon name within the set (kebab-case, e.g. "home", "circle-xmark"). */
	name: string;
	/** Square size in px. Default 20. */
	size?: number;
	className?: string;
	title?: string;
}

/**
 * Render an icon from a registered offline set as inline SVG. Falls back to the
 * Material Symbols ligature when the set/name isn't registered (e.g. the Icon
 * Pack plugin is disabled) — so plugin UI never renders a broken image.
 */
export function Icon({ set, name, size = 20, className, title }: SdkIconProps) {
	const registry = requireHost().useAssetRegistry();
	const setData = registry.iconSet(set);
	const entry: SvgIconEntry | undefined = setData?.icons[name];
	if (setData && entry) {
		const viewBox = entry.v ?? setData.v ?? "0 0 24 24";
		const common =
			setData.mode === "stroke"
				? {
						fill: "none",
						stroke: "currentColor",
						strokeWidth: 2,
						strokeLinecap: "round",
						strokeLinejoin: "round",
					}
				: { fill: "currentColor" };
		return createElement(
			"svg",
			{
				viewBox,
				width: size,
				height: size,
				className,
				title,
				"aria-hidden": title ? undefined : true,
				...common,
			},
			...entry.e.map(([tag, attrs], i) =>
				createElement(tag, { key: i, ...attrs }),
			),
		);
	}
	// Fallback: the Material Symbols ligature — always offline via the Icon
	// Pack's bundled copy (the pack is locked on and its fonts are in index.html).
	return createElement(
		"span",
		{
			className: `material-symbols-outlined select-none${className ? ` ${className}` : ""}`,
			"data-icon": name,
			"aria-hidden": title ? undefined : true,
			title,
			style: { fontSize: size },
		},
		name,
	);
}

/** Re-export React pieces a plugin's JSX needs (keeps imports uniform). */
export { createElement, Fragment };
export { useState, useEffect, useCallback };
