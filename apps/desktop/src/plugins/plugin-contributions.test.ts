import { beforeEach, describe, expect, it } from "vitest";
import {
	allPluginNavItems,
	loadedPlugin,
	pluginDocsSections,
	pluginSettingsSections,
	pluginStoryExports,
	pluginThemes,
	usePluginContributions,
} from "@/plugins/plugin-contributions.js";
import type { PluginBundleExports } from "@vorynth/types";

/**
 * Contribution store — aggregates what runtime UI plugins export. Offline: the
 * store is pure data; registering a plugin and reading its contributions.
 */
describe("usePluginContributions", () => {
	beforeEach(() => {
		usePluginContributions.getState().clear();
	});

	const exports: PluginBundleExports = {
		default: function View() {
			return null;
		},
		navItems: [{ id: "ref", label: "Reference", icon: "extension" }],
		SettingsSection: function Settings() {
			return null;
		},
		docsSection: {
			id: "reference",
			title: "Reference Plugin",
			summary: "s",
			icon: "extension",
			blocks: [{ type: "paragraph", text: "hi" }],
		},
		themes: [
			{
				id: "solar-flare",
				name: "Solar Flare",
				light: { "--color-primary": "196 84 20" },
				dark: { "--color-primary": "255 184 135" },
			},
		],
	};

	it("registers a plugin and exposes all its contributions", () => {
		usePluginContributions.getState().register({
			id: "reference",
			name: "Reference Plugin",
			version: "1.8.0",
			exports,
		});

		expect(allPluginNavItems()).toEqual([
			{
				id: "ref",
				label: "Reference",
				icon: "extension",
				pluginId: "reference",
			},
		]);
		expect(pluginSettingsSections()).toHaveLength(1);
		expect(pluginSettingsSections()[0]?.pluginId).toBe("reference");
		expect(pluginDocsSections()).toHaveLength(1);
		expect(pluginDocsSections()[0]?.id).toBe("reference");
		expect(pluginThemes()).toHaveLength(1);
		expect(pluginThemes()[0]?.id).toBe("solar-flare");
		expect(loadedPlugin("reference")?.name).toBe("Reference Plugin");
	});

	it("ignores plugins without a given contribution", () => {
		usePluginContributions.getState().register({
			id: "bare",
			name: "Bare",
			version: "1.0.0",
			exports: { navItems: [{ id: "b", label: "B", icon: "x" }] },
		});

		// Only navItems contributed — the other lists stay empty.
		expect(allPluginNavItems()).toEqual([
			{ id: "b", label: "B", icon: "x", pluginId: "bare" },
		]);
		expect(pluginDocsSections()).toEqual([]);
		expect(pluginSettingsSections()).toEqual([]);
		expect(pluginThemes()).toEqual([]);
	});

	it("clear() drops all contributions", () => {
		usePluginContributions.getState().register({
			id: "reference",
			name: "Reference Plugin",
			version: "1.8.0",
			exports,
		});
		usePluginContributions.getState().clear();
		expect(allPluginNavItems()).toEqual([]);
		expect(loadedPlugin("reference")).toBeUndefined();
	});

	it("unregister() removes a plugin and all its contributions", () => {
		usePluginContributions.getState().register({
			id: "reference",
			name: "Reference Plugin",
			version: "1.8.0",
			exports,
		});
		expect(allPluginNavItems()).toHaveLength(1);

		usePluginContributions.getState().unregister("reference");
		expect(allPluginNavItems()).toEqual([]);
		expect(pluginSettingsSections()).toEqual([]);
		expect(pluginDocsSections()).toEqual([]);
		expect(pluginThemes()).toEqual([]);
		expect(loadedPlugin("reference")).toBeUndefined();
	});

	it("unregister() of an unknown id is a no-op", () => {
		usePluginContributions.getState().register({
			id: "reference",
			name: "Reference Plugin",
			version: "1.8.0",
			exports,
		});
		usePluginContributions.getState().unregister("ghost");
		// The registered plugin is untouched.
		expect(allPluginNavItems()).toHaveLength(1);
		expect(loadedPlugin("reference")).toBeDefined();
	});

	it("aggregates StoryExports panels (the reader's Export dialog)", () => {
		const withPanel = {
			...exports,
			StoryExports: function ExportPanel() {
				return null;
			},
		};
		usePluginContributions.getState().register({
			id: "story-renderer",
			name: "Story Renderer",
			version: "1.8.0",
			exports: withPanel,
		});
		usePluginContributions.getState().register({
			id: "bare",
			name: "Bare",
			version: "1.0.0",
			exports: { navItems: [{ id: "b", label: "B", icon: "x" }] },
		});

		const panels = pluginStoryExports();
		expect(panels).toHaveLength(1);
		expect(panels[0]?.pluginId).toBe("story-renderer");
		expect(typeof panels[0]?.Component).toBe("function");
	});
});
