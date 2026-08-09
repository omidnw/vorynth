import type { DocsSection } from "../types.js";

/**
 * Plugins — the adapter registry and runtime UI plugins (v1.8.0).
 *
 * Two kinds of plugins exist: adapter plugins (engine-side, they collect your
 * sources) and runtime UI plugins (desktop-side bundles that extend the app
 * itself — a theme, a settings section, a docs guide, a sidebar entry).
 */
export const pluginsSection: DocsSection = {
	id: "plugins",
	title: "Plugins",
	summary:
		"The adapters that collect your sources, the plugins that extend the app itself — and how to switch them off.",
	icon: "extension",
	pageRoute: "/plugins",
	blocks: [
		{
			type: "paragraph",
			text: "Plugins do two very different jobs. Adapter plugins are how Vorynth turns a URL into stories — every collection method (RSS, GitHub releases, arXiv, the HTML crawler, Sitemap, the JSON API, and Reddit) is an adapter plugin listed on the Plugins page, with its version and an on/off switch. Runtime UI plugins are small bundles that extend the app itself: they can add a sidebar entry, a settings section, a guide in this Documentation page, or even a whole theme. The reference plugin ships with Vorynth as a working example of every kind of contribution. Three built-in UI plugins are always on — the Icon Pack powers the app's icons and fonts, and the Story Renderer and Copyright & Attribution plugins power exporting and download credit.",
		},
		{
			type: "paragraph",
			text: "The Plugins page is an engineering surface: by default it stays hidden, and it appears in the sidebar once you switch on 'Show advanced features' in Settings → Advanced. Most people never need it — the connectors your sources need resolve automatically behind the scenes.",
		},
		{
			type: "features",
			items: [
				{
					icon: "extension",
					label: "Adapter plugins",
					text: "Each adapter is one plugin with a name, a description, and a version. The Add Source form reads the plugin's configuration schema, so the fields you see when you pick a method are exactly the ones that plugin needs.",
				},
				{
					icon: "toggle_on",
					label: "Enable / disable",
					text: "Switch an adapter off and its sources pause — the crawler skips them until you turn it back on. Nothing is deleted. UI plugins toggle the same way. The exceptions are the Icon Pack, Story Renderer, and Copyright & Attribution, which are always on.",
				},
				{
					icon: "play_arrow",
					label: "In use / idle",
					text: "Each adapter shows whether it's actually collecting right now: 'In use' when at least one enabled source runs through it, 'Idle' when none does. The state is derived live from your sources — nothing to configure.",
				},
				{
					icon: "shield",
					label: "Core adapters",
					text: "RSS, GitHub releases, Sitemap, and JSON API carry the Core badge — the standard methods that ship with Vorynth. They can be switched off like any plugin, but their sources pause with their own state untouched, so they resume exactly as they were when you turn the plugin back on.",
				},
				{
					icon: "verified",
					label: "Official connectors",
					text: "arXiv is the first Official connector (v1.8.0): a non-core source type that is still built and live-tested by Vorynth — the connector health check collects against a real reference source, so 'Official' means it demonstrably works. Official connectors are distributed through the GitHub connector registry: 'Check GitHub for connectors' fetches their definitions, and a source that needs one auto-provisions it (create or Test) without you ever touching the Plugins page.",
				},
				{
					icon: "smart_display",
					label: "Connector icons",
					text: "Every method has its own icon — RSS, GitHub, arXiv, the crawler, Sitemap, the JSON API, and Reddit each carry a distinct one on the Add Source form and on the Plugins page. A connector can use a Material Symbols glyph from the offline Icon Pack or its own custom artwork (arXiv ships its own red X), all local — nothing needs the network.",
				},
				{
					icon: "palette",
					label: "Plugin themes",
					text: "A UI plugin can ship a theme — a light and a dark palette, its own identity icon (shown in the theme toggle and the Settings picker), and even a canvas background gradient or image. Pick it in Settings → Appearance alongside Light and Dark; the whole app re-skins instantly.",
				},
				{
					icon: "badge",
					label: "Contribution badges",
					text: "The Plugins page badges what each plugin ships — a theme, icon sets, or fonts — with a small colored tag next to the Core/UI badges. The badge shows even when the plugin is switched off, because it's declared by the manifest.",
				},
				{
					icon: "category",
					label: "Icon Pack",
					text: "The Icon Pack core plugin bundles three offline icon sets (Lucide, Font Awesome Solid + Brands) and 18 font families — including Vorynth's own Newsreader and Geist. Any plugin renders them through the SDK (<Icon>), and its gallery at /plugin/icons searches everything. Nothing needs the network. It's always on — the app's own icons and fonts load from it, so there's no toggle and no CDN fallback.",
				},
				{
					icon: "description",
					label: "Story Renderer",
					text: "A core, always-on plugin that reads any Vorynth content — a story, insight, Ask-AI answer, history entry, or period brief — as Markdown, a themed HTML page, or a ready-to-share screenshot. Export buttons across the app open its panel; its own settings (include metadata, prefer the translated text) live on the Settings page.",
				},
				{
					icon: "copyright",
					label: "Copyright & Attribution",
					text: "A core, always-on plugin for media downloads: images download with a credit bar naming the blog, article, and source URL, or as the original. Its setting picks the default; every download still chooses.",
				},
				{
					icon: "menu",
					label: "Sidebar entries",
					text: "A UI plugin can add its own item to the sidebar, linking to its main view at /plugin/<id>.",
				},
				{
					icon: "tune",
					label: "Settings sections",
					text: "A UI plugin can contribute its own section on the Settings page, with options it persists for you.",
				},
				{
					icon: "book",
					label: "Plugin guides",
					text: "Each UI plugin can document itself right here in the Documentation page — the reference plugin's guide appears under Plugins → Reference Plugin.",
				},
				{
					icon: "download",
					label: "Install",
					text: "Press Install plugin and pick a .vorynth-plugin file — a single package holding the plugin's manifest and code. No folder digging, no restart: the engine validates the package, installs it, and the plugin appears under Installed ready to use. Power users can still drop a plugin folder into data/plugins and press Scan for plugins.",
				},
				{
					icon: "delete",
					label: "Remove",
					text: "Installed plugins have a Remove button. Confirming deletes the plugin's row and its bundle folder — your data is never touched. Built-in plugins (Core or not) can't be removed, only switched off.",
				},
				{
					icon: "search",
					label: "Search and organize",
					text: "The Plugins page groups plugins into Core, Installed, and Built-in sections, filters them as you type, and remembers your preference for hiding the Core section across restarts — so the list can stay focused on what you added.",
				},
				{
					icon: "folder_open",
					label: "Open the plugins folder",
					text: "Next to the plugins folder path, 'Open folder' reveals it in your file manager (Finder, File Explorer, or your Linux file manager) and 'Open in terminal' opens a terminal there — handy for inspecting plugins or dropping in a new plugin folder.",
				},
				{
					icon: "shield",
					label: "Security scan",
					text: "Every installed plugin's code is scanned for risky patterns — code injection (eval, the Function constructor, string timers), calls to external sites, hardcoded IP addresses, and unsafe HTML injection. A warning badge on the plugin row shows the result, and the details list each finding. Plugins flagged High ask for a one-time confirmation before you can enable them. Built-in Vorynth plugins are trusted and never scanned.",
				},
			],
		},
		{
			type: "bullets",
			items: [
				"Adapter plugins are built-in and manifest-driven — enabling or disabling one never requires a restart.",
				"The Plugins page appears only after you switch on 'Show advanced features' in Settings → Advanced — it's the power-user gate; the rest of Vorynth never shows plugin terminology.",
				"Each method's icon comes from its plugin manifest — a Material Symbols glyph from the offline Icon Pack, with a built-in fallback.",
				"Turning an adapter off only pauses collection. Each source keeps its own enabled flag, so switching the plugin back on restores exactly the previous state — one source disabled, another enabled stays that way.",
				"The Icon Pack, Story Renderer, and Copyright & Attribution are the always-on plugins — Vorynth's own icons, export panel, and media credit depend on them, so they're always loaded with no toggle.",
				"The dependency line shows when a plugin needs another one to work — disabling a dependency pauses the plugin that relies on it.",
				"UI plugins load at startup from their bundles; a disabled plugin is simply not loaded, so its contributions disappear until you switch it back on.",
				"Installed plugins are always UI plugins — the adapters that collect sources stay in the engine. Uninstalling removes the plugin and its bundle; built-ins can only be switched off.",
				"Plugins run through a narrow SDK — they get React, i18n, navigation, and their own settings, but not the raw engine API — and the app enforces a strict content-security policy as a second layer, so a plugin can't quietly reach engine commands that change your data.",
				"An installed plugin can be scanned again any time — press Scan for plugins and every folder is re-read and re-scanned, so a plugin updated on disk gets a fresh report.",
			],
		},
		{
			type: "flow",
			title: "How a plugin gets installed",
			steps: [
				{
					icon: "download",
					label: "Pick",
					description:
						"Press Install plugin on the Plugins page and choose a .vorynth-plugin file.",
				},
				{
					icon: "package",
					label: "Validate",
					description:
						"The engine checks the package — manifest, bundle, and a safe layout — scans the code for risky patterns, then extracts it into data/plugins.",
				},
				{
					icon: "check_circle",
					label: "Listed",
					description:
						"The plugin appears under Installed with its version and contribution badges.",
				},
				{
					icon: "memory",
					label: "Load",
					description:
						"If it's enabled, Vorynth loads its bundle and the contributions appear.",
				},
			],
		},
		{
			type: "flow",
			title: "How a runtime UI plugin reaches your app",
			steps: [
				{
					icon: "package",
					label: "Bundle",
					description:
						"The plugin's code is built into a single JavaScript bundle.",
				},
				{
					icon: "publish",
					label: "Publish",
					description: "The bundle ships inside the app's plugin folder.",
				},
				{
					icon: "memory",
					label: "Load",
					description:
						"Vorynth loads the bundles of every enabled UI plugin at startup.",
				},
				{
					icon: "extension",
					label: "Contribute",
					description:
						"Each bundle hands over its theme, settings section, docs guide, and sidebar items.",
				},
			],
		},
	],
};
