import {
	VORYNTH_VERSION,
	type ConfigField,
	type PluginKind,
	type PluginTier,
	type SourceType,
} from "@vorynth/types";

/**
 * Built-in plugin manifests (v1.8.0 — "adapter-as-plugin" + runtime UI plugins,
 * project-details.md §27-30).
 *
 * Every plugin the app knows has one manifest here — metadata (name,
 * description, version, kind, dependencies) plus, for adapters, the Add Source
 * form's per-method configuration schema (`configFields`). The `plugins` table
 * only persists the user's enable/disable toggle and per-plugin configuration —
 * manifests live in code, never in the DB (R-A09).
 *
 * Core adapters (rss, github-releases, sitemap, api) ship enabled and
 * carry the "Core" badge — the standard collection methods. They are NOT locked:
 * any plugin can be disabled, and disabling an adapter pauses its sources while
 * leaving each source's own enabled flag untouched, so re-enabling restores
 * exactly the previous state (the crawler gates on the plugin's effective
 * enable state, never on touching source rows). UI plugins are runtime code
 * bundles the desktop loads at runtime; the reference plugin ships disabled —
 * it is living documentation, opted in when someone wants the example running.
 *
 * The one exception is the Icon Pack (`icons`): it carries `locked: true` and is
 * always on — Vorynth's own icons and fonts depend on it, so there is no toggle
 * for it anywhere. `PluginsService` refuses to disable a locked plugin, and its
 * effective enable state is always true.
 */

export interface AdapterManifest {
	/** Stable plugin id — equals the adapter registry name (`sources.adapter`). */
	id: string;
	name: string;
	description: string;
	version: string;
	/**
	 * A Material Symbols ligature from the Icon Pack, shown beside the plugin on
	 * the Plugins page and next to the method in the Add Source form. A connector
	 * may ship a custom image icon instead — see `iconSrc`.
	 */
	icon?: string;
	/**
	 * Custom image icon (v1.8.0): a local, offline URL for the connector's own
	 * artwork (e.g. "/plugins/arxiv/icon.svg" — served from the app). When set,
	 * the UI renders it as an <img> instead of the `icon` ligature. Never a
	 * remote URL (local-first).
	 */
	iconSrc?: string;
	/** "adapter" (source adapter) or "ui" (runtime code plugin). */
	kind: PluginKind;
	/** The source type this plugin serves (adapters); UI-plugin ids otherwise. */
	type:
		SourceType | "reference" | "icons" | "story-renderer" | "media-copyright";
	core?: boolean;
	/** Trust tier (v1.8.0): "official" = Vorynth-built + live-tested. Built-in
	 *  core adapters carry no tier. */
	tier?: PluginTier;
	enabledByDefault?: boolean;
	/**
	 * A locked plugin is always on — it cannot be disabled and its effective
	 * enable state is always true. Reserved for plugins the app itself depends
	 * on (the Icon Pack: the app's icons and fonts load from it). Locked plugins
	 * must also be `enabledByDefault: true`.
	 */
	locked?: boolean;
	/** Other plugin ids this one depends on. Empty for all built-ins today. */
	dependencies?: string[];
	/**
	 * Contribution tags surfaced as badges on the Plugins page ("theme",
	 * "icons", "fonts"). Declared statically so the badge shows either way.
	 */
	contributions?: string[];
	/** Add Source form fields for this method (adapter plugins). */
	configFields: ConfigField[];
}

/** Shared field builder — keeps the manifests terse. */
function field(
	key: string,
	label: string,
	type: ConfigField["type"],
	opts: Partial<ConfigField> = {},
): ConfigField {
	return { key, label, type, ...opts };
}

export const ADAPTER_MANIFESTS: AdapterManifest[] = [
	{
		id: "rss",
		name: "RSS",
		description:
			"Web feeds — the standard way sites publish new stories. Parses the feed URL into stories with title, content, date, and author.",
		version: VORYNTH_VERSION,
		kind: "adapter",
		type: "rss",
		icon: "rss_feed",
		core: true,
		enabledByDefault: true,
		configFields: [
			field("feedUrl", "Feed URL", "url", {
				required: true,
				placeholder: "https://example.com/feed.xml",
			}),
		],
	},
	{
		id: "github-releases",
		name: "GitHub Releases",
		description:
			"A repository's release notes. Given an owner and repo, collects each release as a story.",
		version: VORYNTH_VERSION,
		kind: "adapter",
		type: "github",
		icon: "hub",
		core: true,
		enabledByDefault: true,
		configFields: [
			field("owner", "Owner", "text", {
				required: true,
				placeholder: "vercel",
			}),
			field("repo", "Repository", "text", {
				required: true,
				placeholder: "next.js",
			}),
		],
	},
	{
		id: "html",
		name: "HTML Crawler",
		description:
			"For sites with no feed at all. Point at a listing page and give CSS selectors for article containers and links; Vorynth extracts each story from its page.",
		version: VORYNTH_VERSION,
		kind: "adapter",
		type: "html",
		icon: "html",
		enabledByDefault: true,
		configFields: [
			field("crawl.url", "Page URL", "url", {
				required: true,
				placeholder: "https://example.com/news",
				hint: "The listing page (item mode) or a single article page.",
			}),
			field("crawl.itemSelector", "Item selector", "text", {
				placeholder: "article, .post, .entry …",
				hint: "CSS selector for each article container on the listing page. Leave empty to treat the URL as a single article.",
			}),
			field("crawl.linkSelector", "Link selector", "text", {
				placeholder: "a[href]",
				hint: "CSS selector for the article link, relative to each item.",
			}),
			field("crawl.titleSelector", "Title selector", "text", {
				placeholder: "h1, .entry-title …",
			}),
			field("crawl.contentSelector", "Content selector", "text", {
				placeholder: "article, .entry-content …",
			}),
			field("crawl.dateSelector", "Date selector", "text", {
				placeholder: "time, .published …",
			}),
			field("crawl.authorSelector", "Author selector", "text", {
				placeholder: ".author, [rel=author] …",
			}),
			field("crawl.maxItems", "Max items", "number", {
				placeholder: "10",
				hint: "How many article pages to fetch per run (default 10).",
			}),
		],
	},
	{
		id: "sitemap",
		name: "Sitemap",
		description:
			"Sites that publish a sitemap.xml. Reads the URL list from the sitemap, then fetches each listed page as a story.",
		version: VORYNTH_VERSION,
		kind: "adapter",
		type: "sitemap",
		icon: "map",
		core: true,
		enabledByDefault: true,
		configFields: [
			field("sitemap.sitemapUrl", "Sitemap URL", "url", {
				required: true,
				placeholder: "https://example.com/sitemap.xml",
			}),
		],
	},
	{
		id: "api",
		name: "JSON API",
		description:
			"Structured data endpoints. Fetches a JSON endpoint and maps each record onto a story with the field names you provide.",
		version: VORYNTH_VERSION,
		kind: "adapter",
		type: "api",
		icon: "api",
		core: true,
		enabledByDefault: true,
		configFields: [
			field("api.apiUrl", "API URL", "url", {
				required: true,
				placeholder: "https://api.example.com/v1/posts",
			}),
			field("api.itemsPath", "Items path", "text", {
				placeholder: "items, data.posts …",
				hint: "Dotted path to the records array inside the JSON. Empty = the top level is the array.",
			}),
			field("api.titleField", "Title field", "text", {
				required: true,
				placeholder: "title",
			}),
			field("api.contentField", "Content field", "text", {
				placeholder: "body",
			}),
			field("api.urlField", "URL field", "text", {
				placeholder: "link",
			}),
			field("api.dateField", "Date field", "text", {
				placeholder: "published_at",
			}),
			field("api.authorField", "Author field", "text", {
				placeholder: "author.name",
			}),
			field("api.headers", "Headers (JSON)", "textarea", {
				placeholder: '{"Authorization": "Bearer …"}',
				hint: "Optional HTTP headers sent with the request.",
			}),
		],
	},
	{
		id: "reference",
		name: "Reference Plugin",
		description:
			"A built-in example that shows everything a runtime UI plugin can contribute — a theme, a settings section, a docs guide, and a sidebar entry. Its source is the template for building your own plugins.",
		version: VORYNTH_VERSION,
		kind: "ui",
		type: "reference",
		icon: "extension",
		enabledByDefault: false,
		contributions: ["theme"],
		configFields: [],
	},
	{
		id: "icons",
		name: "Icon Pack",
		description:
			"Offline icon sets (Lucide, Font Awesome, Material Symbols) and bundled fonts — Vorynth's own Newsreader/Geist, popular Latin fonts, and fonts for Persian/Arabic, CJK, Hebrew, Devanagari, and Thai scripts. Other plugins consume them through the plugin SDK; nothing needs the network.",
		version: VORYNTH_VERSION,
		kind: "ui",
		type: "icons",
		icon: "palette",
		core: true,
		enabledByDefault: true,
		locked: true,
		contributions: ["icons", "fonts"],
		configFields: [],
	},
	{
		id: "story-renderer",
		name: "Story Renderer",
		description:
			"Reads any story as Markdown, as a beautifully themed HTML document, or as a ready-to-share screenshot (PNG) — always on, no network needed. An Export button in the article reader opens its panel.",
		version: VORYNTH_VERSION,
		kind: "ui",
		type: "story-renderer",
		icon: "auto_stories",
		core: true,
		enabledByDefault: true,
		locked: true,
		contributions: ["renderer"],
		configFields: [],
	},
	{
		id: "media-copyright",
		name: "Copyright & Attribution",
		description:
			"Adds copyright attribution to media downloads on the Media page — the blog it came from, the article title, and the source URL are credited in the downloaded image. Turn the default off here; each download can still choose.",
		version: VORYNTH_VERSION,
		kind: "ui",
		type: "media-copyright",
		icon: "copyright",
		core: true,
		enabledByDefault: true,
		locked: true,
		contributions: ["copyright"],
		configFields: [],
	},
];

/**
 * Official connectors (v1.8.0) no longer live in code. They are distributed
 * through the GitHub connector registry (`connectors/registry.json`, fetched
 * by ConnectorRegistryService): each entry declares the source type it serves
 * plus its definition (configFields, icon, tier, version), and is live-
 * updatable without an app update. Their ADAPTER IMPLEMENTATIONS stay compiled
 * in the engine (trusted, no bundle execution — R-A13), so "official" means
 * both "built by Vorynth" and "live-tested" (the connector health check runs
 * each one against a real reference source). A registered official connector
 * resolves exactly like a built-in through ConnectorRegistryService.
 *
 * The first official connector is arXiv.
 */

/** The plugin that serves a given source type (built-in). Official connectors
 *  resolve via ConnectorRegistryService on top of this. */
export function manifestForType(type: SourceType): AdapterManifest | undefined {
	return ADAPTER_MANIFESTS.find((m) => m.type === type);
}

/** Every code-registered manifest (built-ins), in order. */
export const ALL_PLUGIN_MANIFESTS: AdapterManifest[] = ADAPTER_MANIFESTS;
