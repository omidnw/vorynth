/**
 * Vorynth shared DTO types.
 *
 * These are the ONLY contract that crosses the frontend ↔ core-engine boundary.
 * Both apps import directly from `@vorynth/types` — no code duplication, no
 * drift. Shapes are derived from project-details.md §21 (main entities).
 */

// ──────────────────────────────────────────────────────────────────────────
// Source layer
// ──────────────────────────────────────────────────────────────────────────

export type SourceType =
	"rss" | "api" | "html" | "sitemap" | "github" | "arxiv";

export type SourceCategory =
	| "ai"
	| "software-engineering"
	| "programming-languages"
	| "web-development"
	| "backend"
	| "devops"
	| "cloud"
	| "security"
	| "open-source"
	| "other"
	// Custom categories the user types in the Add Source form (v1.6.0). The
	// engine stores any string; this keeps the built-ins typed while allowing
	// free-form values via the index signature.
	| (string & {});

/**
 * HTML-crawl selector config (project-details.md §30, v1.8.0).
 *
 * Two modes:
 * - **Item-list mode** — `itemSelector` (CSS) picks the article containers on
 *   the listing page; `linkSelector` (relative to each item) gives the article
 *   URL; each article page is then fetched and extracted with the
 *   title/content/date/author selectors.
 * - **Single-page mode** — no `itemSelector`/`linkSelector`: `url` IS the
 *   article; title/content/date/author are extracted from that one page.
 */
export interface HtmlCrawlConfig {
	/** The listing page (item-list mode) or the article page (single-page mode). */
	url: string;
	/** CSS selector for article containers on the listing page. */
	itemSelector?: string;
	/** CSS selector for the article link, relative to each item. */
	linkSelector?: string;
	/** CSS selector for the title (on the article page, or in item-list mode). */
	titleSelector?: string;
	/** CSS selector for the article body. */
	contentSelector?: string;
	/** CSS selector for the publish date (a `<time>` or text node). */
	dateSelector?: string;
	/** CSS selector for the author. */
	authorSelector?: string;
	/** Max article pages to fetch in item-list mode (default 10). */
	maxItems?: number;
}

/** Legacy HTML selector shape (project-details.md §30, pre-v1.8.0). */
export interface HtmlSelectorConfig {
	titleSelector?: string;
	contentSelector?: string;
	dateSelector?: string;
	authorSelector?: string;
}

/** Sitemap crawl config — an XML sitemap URL whose `<loc>` pages become stories. */
export interface SitemapSourceConfig {
	/** Absolute URL of the sitemap (or sitemap index). */
	sitemapUrl: string;
	/** Optional selector/fallback extraction selectors for each page. */
	titleSelector?: string;
	contentSelector?: string;
}

/** Generic JSON API source config — maps API records onto article fields. */
export interface ApiSourceConfig {
	/** Absolute URL of the JSON endpoint. */
	apiUrl: string;
	/** Optional JSON pointer / dotted path to the records array (e.g. "items" or "data.posts"). */
	itemsPath?: string;
	/** Field paths (dotted) inside each record for the article fields. */
	titleField: string;
	contentField?: string;
	urlField?: string;
	dateField?: string;
	authorField?: string;
	/** Optional HTTP headers sent with the request (e.g. Authorization). */
	headers?: Record<string, string>;
}

/** Opaque, engine-defined per adapter (e.g. RSS feed URL, HTML selectors). */
export type SourceConfiguration = Record<string, unknown> & {
	/** Present when {@link SourceType} is "html" (v1.8.0). */
	crawl?: HtmlCrawlConfig;
	/** Present when {@link SourceType} is "sitemap" (v1.8.0). */
	sitemap?: SitemapSourceConfig;
	/** Present when {@link SourceType} is "api" (v1.8.0). */
	api?: ApiSourceConfig;
	/** Legacy selector shape (pre-v1.8.0). Kept for backward compatibility. */
	selectors?: HtmlSelectorConfig;
};

// ──────────────────────────────────────────────────────────────────────────
// Source semantic metadata (v1.8.0 — the "source intelligence layer" data)
// ──────────────────────────────────────────────────────────────────────────
// Three axes describe what a source IS beyond its feed: where it comes from
// (origin — already stored as country/city), how broadly it matters (scope),
// how credible it is (authority), and what fields it touches (impactAreas).
// Today these are stored and editable; the AI ranking layer that reasons over
// them is a later step. NULL on a source row = not yet classified.

/** How broadly a source's subject matters — the "who does it affect" axis. */
export type SourceScope =
	"global" | "regional" | "national" | "local" | "community";

/** The source's credibility class — the "how much should we trust it" axis. */
export type SourceAuthority =
	"official" | "research" | "community" | "media" | "aggregator" | "personal";

export const SOURCE_SCOPES: SourceScope[] = [
	"global",
	"regional",
	"national",
	"local",
	"community",
];

export const SOURCE_AUTHORITIES: SourceAuthority[] = [
	"official",
	"research",
	"community",
	"media",
	"aggregator",
	"personal",
];

/**
 * Suggested impact-area vocabulary (v1.8.0) — lowercase slugs the AI ranking
 * layer can reason over. Values are stored as-is (like categories), so any
 * slug works; these are the ones the Add/Edit source form suggests.
 */
export const SOURCE_IMPACT_AREAS = [
	"ai",
	"ml",
	"llm",
	"agents",
	"hardware",
	"compute",
	"cloud",
	"security",
	"privacy",
	"internet",
	"web",
	"frontend",
	"backend",
	"devops",
	"infrastructure",
	"networking",
	"kubernetes",
	"databases",
	"data",
	"programming-languages",
	"javascript",
	"typescript",
	"rust",
	"python",
	"go",
	"architecture",
	"performance",
	"testing",
	"open-source",
	"design",
	"gaming",
	"crypto",
	"mobile",
	"robotics",
	"science",
	"research",
] as const;

export interface Source {
	id: string;
	name: string;
	url: string;
	type: SourceType;
	category: SourceCategory;
	adapter: string;
	configuration: SourceConfiguration;
	enabled: boolean;
	/**
	 * The source list this source belongs to (v1.8.0). NULL = a user-created
	 * source ("My sources"). List sources are hidden from the page and the
	 * crawler when their list is turned off; the rows themselves are never
	 * deleted — turning the list back on restores them with edits intact.
	 */
	listId: string | null;
	/**
	 * Geography/language tags (v1.8.0) — ISO 3166-1 alpha-2 country code,
	 * free-text city/region, ISO 639-1 language code. NULL = untagged. The
	 * Sources page groups/browses by these and shows a language badge.
	 */
	country: string | null;
	city: string | null;
	language: string | null;
	/**
	 * Semantic metadata (v1.8.0) — "who does it affect" (`scope`), "how
	 * credible is it" (`authority`), and "what fields it touches"
	 * (`impactAreas`). NULL = not yet classified. Today this is stored and
	 * editable (the data-holding layer); the intelligence/ranking layer that
	 * reasons over it is a later step (v2 "source intelligence layer").
	 */
	scope: SourceScope | null;
	authority: SourceAuthority | null;
	impactAreas: string[] | null;
	/**
	 * Free-form user tags (v1.9.0) — lowercase slugs ("cloud", "ai"). The
	 * curated vocabulary (tech-catalog + app vocab) is a UI suggestion, not a
	 * constraint. NULL = none.
	 */
	tags: string[] | null;
	/**
	 * Per-source fetch window in days. The crawler only keeps articles newer
	 * than this. Default 7 (one week); user can override per source. 0 = unlimited.
	 */
	fetchWindowDays: number;
	/**
	 * Absolute time range (v1.6.0). When `fetchFrom` is set, the source keeps
	 * articles published within [fetchFrom, fetchTo] instead of the relative
	 * `fetchWindowDays` window. Both null = relative mode.
	 */
	fetchFrom: Date | null;
	fetchTo: Date | null;
	lastCheckedAt: Date | null;
	createdAt: Date;
}

export interface CreateSourceInput {
	name: string;
	url: string;
	type: SourceType;
	category: SourceCategory;
	adapter?: string;
	configuration?: SourceConfiguration;
	enabled?: boolean;
	fetchWindowDays?: number;
	/** Optional geography/language tags (v1.8.0). */
	country?: string | null;
	city?: string | null;
	language?: string | null;
	/** Optional semantic metadata (v1.8.0) — see `Source.scope`. */
	scope?: SourceScope | null;
	authority?: SourceAuthority | null;
	impactAreas?: string[] | null;
	/** Free-form tags (v1.9.0) — lowercase slugs; see `Source.tags`. */
	tags?: string[] | null;
}

export interface UpdateSourceInput {
	name?: string;
	enabled?: boolean;
	/** 0 = unlimited. */
	fetchWindowDays?: number;
	/** Absolute range mode — set `fetchFrom` to switch to from/to dates. */
	fetchFrom?: Date | null;
	fetchTo?: Date | null;
	configuration?: SourceConfiguration;
	/** Free-form category (v1.8.0 — editable in the Source form). */
	category?: string;
	/** Optional geography/language tags (v1.8.0). */
	country?: string | null;
	city?: string | null;
	language?: string | null;
	/** Optional semantic metadata (v1.8.0) — see `Source.scope`. */
	scope?: SourceScope | null;
	authority?: SourceAuthority | null;
	impactAreas?: string[] | null;
	/** Free-form tags (v1.9.0) — lowercase slugs; see `Source.tags`. */
	tags?: string[] | null;
}

/** The group-by dimensions on the Sources page (v1.8.0). */
export type SourceGroupDimension = "category" | "country" | "city" | "language";

/**
 * Bulk enable/disable — flip `enabled` on every source whose dimension equals
 * `value` (e.g. enable all sources in category "security", or country "US").
 * Used by the Sources page group master switches.
 */
export interface BulkSourceEnableInput {
	dimension: SourceGroupDimension;
	value: string;
	enabled: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// Source lists (v1.8.0 — curated collections)
// ──────────────────────────────────────────────────────────────────────────

/** Where a source list comes from — trusted in-app code (official) or the
 * GitHub community catalog (community, downloaded once and cached). */
export type SourceListOrigin = "official" | "community" | "import";

/**
 * One source definition inside a list. Mirrors the seed-source shape; when a
 * list is enabled its definitions materialize as real `sources` rows via
 * `INSERT OR IGNORE` by fixed id — user edits (toggle, fetch window) are never
 * overwritten by later refreshes.
 */
export interface SourceListSourceDefinition {
	/** Fixed source id — stable across refreshes so toggles/edits survive. */
	id: string;
	name: string;
	url: string;
	type: SourceType;
	category: SourceCategory;
	adapter: string;
	configuration: SourceConfiguration;
	/** Default fetch window in days (0 = unlimited). Default 7. */
	fetchWindowDays?: number;
	/** Optional geography/language tags (v1.8.0). */
	country?: string | null;
	city?: string | null;
	language?: string | null;
	/** Optional semantic metadata (v1.8.0) — see `Source.scope`. */
	scope?: SourceScope | null;
	authority?: SourceAuthority | null;
	impactAreas?: string[] | null;
}

/**
 * v1.8.1 — one row of the sources preview modal: a list's cached definition
 * merged with the materialized row's `enabled` state. A list that hasn't been
 * enabled yet has no `sources` rows, so `enabled` is false for all of them.
 */
export interface SourceListSourcePreview {
	/** Fixed source id — stable across refreshes so toggles/edits survive. */
	id: string;
	name: string;
	/** The site's URL (the feed/API endpoint lives in `configuration`). */
	url: string;
	category: SourceCategory;
	adapter: string;
	enabled: boolean;
}

/** One curated list of sources (official or community). */
export interface SourceListInfo {
	id: string;
	name: string;
	description: string;
	origin: SourceListOrigin;
	/**
	 * 18+ flag — surfaced as an "18+" badge with a confirm-to-enable dialog.
	 * The user's age is unknown, so adult lists are hidden from browsing by
	 * default (see the `sourceLists.hideAdult` setting).
	 */
	nsfw: boolean;
	/**
	 * Master switch — when off, the list's sources are hidden from the Sources
	 * page AND skipped by the crawler (rows kept; toggling back restores them).
	 */
	enabled: boolean;
	/** List definition version (community lists carry one from the catalog). */
	version: string | null;
	/** Curator for community lists, derived from their repo path; null for official. */
	curator: string | null;
	/** Number of sources defined by this list. */
	sourceCount: number;
	/** How many of this list's sources are individually enabled. */
	enabledCount: number;
	/**
	 * v1.8.1 — a community list downloaded from the repo has an "Update"
	 * button (a newer file there updates its sources). False for
	 * official/imported lists and lists whose repo path is unknown.
	 */
	canUpdate: boolean;
	/** ISO timestamp of the last catalog refresh (community), or null. */
	updatedAt: string | null;
	createdAt: string;
}

/** Result of `POST /source-lists/refresh` — the community catalog sync. */
export interface RefreshCatalogResult {
	/** List ids newly discovered by this refresh. */
	added: string[];
	/** List ids whose definition changed (version bump or content change). */
	updated: string[];
	/** List ids removed because their file left the repo. */
	removed: string[];
	/** List ids re-downloaded with identical content (no-op). */
	unchanged: string[];
	/** List files that failed to parse/validate — cache kept, errors logged. */
	skipped: string[];
}

/** Result of `POST /connectors/refresh` — the official connector registry sync
 *  (v1.8.0). The registry distributes connector DEFINITIONS; adapter code stays
 *  compiled in the engine. */
export interface RefreshConnectorsResult {
	/** Connector ids newly registered. */
	added: string[];
	/** Connector ids whose definition changed (version/fields/icon). */
	updated: string[];
	/** Connector ids re-fetched with identical content (no-op). */
	unchanged: string[];
	/** Registry entries rejected (unknown adapter, invalid shape, too-new
	 *  minVorynthVersion, …) — cache kept, reasons logged. */
	skipped: string[];
}

// ──────────────────────────────────────────────────────────────────────────
// Plugin / adapter registry (v1.8.0 — adapter-as-plugin, project-details §27)
// ──────────────────────────────────────────────────────────────────────────

/**
 * One field of an adapter's configuration schema, rendered by the Add Source
 * form when that method is picked. Drives the data-driven configuration UI.
 */
export interface ConfigField {
	/** Configuration key, e.g. "crawl.url" or "apiUrl". */
	key: string;
	/** UI label. */
	label: string;
	/** Input kind: text / url / number / textarea. */
	type: "text" | "url" | "number" | "textarea";
	required?: boolean;
	placeholder?: string;
	/** Short help shown under the field. */
	hint?: string;
}

/** What a plugin contributes at runtime (v1.9.0): adapter or UI. */
export type PluginKind = "adapter" | "ui";

/**
 * Trust tier for non-core plugins (v1.8.0). "official" = built and live-tested
 * by Vorynth (a reference source in the connector health check); "community" =
 * third-party. A promoted community plugin keeps its "community" tag. Built-in
 * core plugins carry no tier — `core` already marks them.
 */
export type PluginTier = "official" | "community";

/** A registered plugin (built-in, manifest-driven). */
export interface PluginInfo {
	id: string;
	name: string;
	description: string;
	version: string;
	/**
	 * "adapter" = a source adapter (serves a source type); "ui" = a runtime
	 * code plugin that contributes nav/settings/docs/theme to the app (v1.9.0).
	 */
	kind: PluginKind;
	/** The source type this adapter serves (adapter plugins), or "reference". */
	type: SourceType | (string & {});
	/** Adapter registry name — matches `sources.adapter` (adapter plugins). */
	adapter: string;
	/**
	 * A Material Symbols ligature from the Icon Pack, shown beside the plugin
	 * on the Plugins page and next to the method in the Add Source form. A
	 * connector may ship a custom image icon instead — see `iconSrc`.
	 */
	icon?: string;
	/**
	 * Custom image icon (v1.8.0): a local, offline URL for the connector's own
	 * artwork — a bundled asset served from the app (`/plugins/<id>/icon.svg`)
	 * or, for installed packages, from the engine's plugin folder
	 * (`GET /plugins/:id/assets/<file>`). When set, the UI renders it as an
	 * <img> instead of the `icon` ligature. Never a remote URL (local-first).
	 */
	iconSrc?: string;
	/**
	 * Trust tier for non-core plugins (v1.8.0): "official" = built and
	 * live-tested by Vorynth; "community" (or absent) = third-party.
	 */
	tier?: PluginTier;
	/**
	 * Core plugins carry the "Core" badge and ship enabled. They are not
	 * locked — disabling one pauses its sources (state preserved).
	 */
	core: boolean;
	/**
	 * A locked plugin is always on — Vorynth itself depends on it (the Icon
	 * Pack powers the app's own icons and fonts), so the engine refuses to
	 * disable it and its effective enable state is always true. The desktop
	 * renders it without a toggle, as an "Always on" plugin.
	 */
	locked?: boolean;
	/** User toggle state from the plugins table. */
	enabled: boolean;
	/** `enabled` AND all dependencies enabled. What the app consults. */
	effectiveEnabled: boolean;
	/**
	 * Derived, never stored (R-A09): true when at least one enabled source uses
	 * this plugin's adapter — "in use" on the Plugins page. UI plugins (no
	 * adapter) always report false.
	 */
	active?: boolean;
	/** Other plugin ids this one depends on. */
	dependencies: string[];
	/** Configuration schema for the Add Source form (adapter plugins). */
	configFields: ConfigField[];
	/** Persisted per-plugin configuration (v1.8.0 — UI plugin settings). */
	configuration?: Record<string, unknown>;
	/**
	 * Contribution tags declared by the manifest ("theme", "icons", "fonts") —
	 * what a plugin ships, surfaced as badges on the Plugins page. Declared
	 * statically so the badge shows whether the plugin is on or off.
	 */
	contributions?: string[];
	/**
	 * True for user-installed plugins (dropped into the engine's data/plugins/
	 * folder + scanned). Built-in plugins omit this. Installed plugins are the
	 * only ones that can be uninstalled.
	 */
	installed?: boolean;
	/**
	 * Static-analysis report of an installed plugin's bundle (v1.8.0). Present
	 * only for user-installed plugins — built-ins are trusted Vorynth code and
	 * are never scanned. The desktop surfaces warnings when the worst severity
	 * is medium or high.
	 */
	security?: PluginSecurityReport;
}

/**
 * Manifest for a user-installed plugin — the `plugin.json` the user drops next
 * to `bundle.js` in `data/plugins/<id>/`. Installed plugins are UI-only today:
 * they contribute nav/docs/settings/themes at runtime, never a source type.
 */
export interface InstalledPluginManifest {
	/** Stable plugin id — must not collide with a built-in plugin id. */
	id: string;
	name: string;
	description?: string;
	version: string;
	/** Contribution tags ("theme", "icons", "fonts", …). */
	contributions?: string[];
	/** Icon Pack ligature (v1.8.0 — custom icon support). */
	icon?: string;
	/** Local asset path inside the package, e.g. "./assets/icon.png" (served
	 *  via GET /plugins/:id/assets/<file>). Offline — never a remote URL. */
	iconSrc?: string;
	/** Trust tier (v1.8.0): "official" = Vorynth-built + tested. */
	tier?: PluginTier;
}

/** Result of `POST /plugins/scan` — the currently installed plugins. */
export interface PluginScanResult {
	/** Plugin ids newly registered by this scan. */
	added: string[];
	/** Plugin ids dropped because their folder disappeared. */
	removed: string[];
}

/** Where the engine looks for dropped-in plugin folders (`data/plugins/`). */
export interface PluginDirInfo {
	dir: string;
}

/** `InstalledPlugin` row + manifest, exposed to the desktop for Remove. */
export interface InstalledPluginInfo extends PluginInfo {
	installed: true;
}

/** Worst severity of a plugin bundle's security scan. */
export type PluginSecuritySeverity = "clean" | "low" | "medium" | "high";

/**
 * One finding from a plugin bundle security scan (v1.8.0). The scanner is
 * intentionally conservative — it reports patterns, and the user decides.
 */
export interface PluginSecurityFlag {
	/** Stable rule id ("eval", "external-url", "hardcoded-ip", …). */
	id: string;
	/** Severity of this single pattern. */
	severity: Exclude<PluginSecuritySeverity, "clean">;
	/** Human-readable label — surfaced on the Plugins page. */
	label: string;
	/** Short matched snippet from the bundle (truncated). */
	evidence: string;
	/** How many times the pattern appeared in the bundle. */
	count: number;
}

/**
 * Static-analysis report of an installed plugin's bundle, produced by the
 * engine at scan/install time. Built-in plugins are trusted and never carry
 * one. The desktop shows a warning badge when `severity` is medium or high,
 * and requires explicit confirmation before enabling a HIGH-flagged plugin.
 */
export interface PluginSecurityReport {
	/** Worst severity across all flags — "clean" when nothing matched. */
	severity: PluginSecuritySeverity;
	/** Every pattern that matched, grouped per rule. */
	flags: PluginSecurityFlag[];
	/** ISO timestamp of the scan. */
	scannedAt: string;
}

export interface UpdatePluginInput {
	enabled?: boolean;
	/**
	 * v1.9.0 — merged into the plugin's persisted `configuration` JSON.
	 * UI plugins read this to persist their settings.
	 */
	configuration?: Record<string, unknown>;
}

/** Result of `POST /sources/verify` — a dry run of a source config. */
export interface VerifySourceResult {
	ok: boolean;
	/** Present when the adapter/config was invalid. */
	error?: string;
	/** Number of items the adapter would collect (capped). */
	itemCount: number;
	/** Titles of the first few items, so the user can sanity-check. */
	samples: string[];
}

/** Body of `POST /sources/verify` — what to test before saving. */
export interface VerifySourceInput {
	type: SourceType;
	/** The primary URL (shown in the source list). */
	url: string;
	configuration?: SourceConfiguration;
}

// ──────────────────────────────────────────────────────────────────────────
// In-app docs blocks (moved here from the desktop for the plugin SDK, v1.9.0)
// ──────────────────────────────────────────────────────────────────────────

/** A visual flow step — rendered as an icon chip with arrows between steps. */
export interface FlowStep {
	icon: string;
	label: string;
	description?: string;
}

export type DocsBlock =
	| { type: "paragraph"; text: string; id?: string }
	| { type: "bullets"; items: string[]; id?: string }
	| {
			type: "features";
			items: { icon: string; label: string; text?: string }[];
			/** Anchor for this block (e.g. `sources-method-rss` deep links). */
			id?: string;
	  }
	| { type: "flow"; title?: string; steps: FlowStep[]; id?: string };

export interface DocsSection {
	/** Stable slug — the `#<id>` fragment on /docs. */
	id: string;
	title: string;
	summary: string;
	/** Material Symbols icon shown next to the section heading. */
	icon: string;
	/** Link back to the page this section documents (bidirectional). */
	pageRoute?: string;
	blocks: DocsBlock[];
}

// ──────────────────────────────────────────────────────────────────────────
// Runtime UI plugin contract (v1.9.0 — plugin host bridge)
// ──────────────────────────────────────────────────────────────────────────

/** A theme a UI plugin ships — light + dark token maps overriding `--color-*`. */
export interface PluginTheme {
	id: string;
	name: string;
	/** `--color-*` var → "r g b" triplet for light mode. */
	light: Record<string, string>;
	/** `--color-*` var → "r g b" triplet for dark mode. */
	dark: Record<string, string>;
	/**
	 * The theme's identity icon (Material Symbols name) — shown in the theme
	 * toggle and picker instead of the light/dark sun & moon.
	 */
	icon?: string;
	/**
	 * Optional app-canvas background (raw CSS `background` value: a gradient or
	 * image) per mode. Flat colors keep flowing through the token maps; this is
	 * the escape hatch for backgrounds the "r g b" triplet pipeline can't carry.
	 */
	background?: {
		light?: string;
		dark?: string;
	};
}

/** A sidebar nav item a UI plugin contributes. */
export interface PluginNavItem {
	id: string;
	label: string;
	/** Material Symbols icon name. */
	icon: string;
}

/** A registered offline icon set id (Icon Pack plugin): lucide / fa-solid / fa-brands. */
export type IconSetId = "lucide" | "fa-solid" | "fa-brands" | (string & {});

/** An offline `@font-face` registration (Icon Pack plugin fonts). */
export interface PluginFontFace {
	/** Font family name (e.g. "Inter"). */
	family: string;
	/** Font weight, e.g. "400" / "700" / "variable". */
	weight?: string;
	style?: string;
	/** Absolute URL the webview can fetch (e.g. "/plugins/icons/fonts/inter-400.woff2"). */
	src: string;
}

/** One rendered SVG element: `[tag, attrs]` (from the Icon Pack build output). */
export interface SvgIconEntry {
	/** Per-icon viewBox override (Font Awesome icons vary; Lucide inherits the set default). */
	v?: string;
	/** SVG element tree — path/circle/rect/… as [tag, attrs] pairs. */
	e: Array<[string, Record<string, string>]>;
}

/** A registered offline icon set (one `icons.*.json` file from the Icon Pack). */
export interface IconSetData {
	/** How the set renders: stroke-based (Lucide) or fill-based (Font Awesome). */
	mode: "stroke" | "fill";
	/** Default viewBox, overridden per icon by {@link SvgIconEntry.v}. */
	v?: string;
	/** Icon name (kebab-case) → element tree. */
	icons: Record<string, SvgIconEntry>;
}

/** One family in the Icon Pack font catalog (`fonts/fonts.json`). */
export interface FontFamilyInfo {
	family: string;
	/** Script the family covers — latin / persian / arabic / cjk / … */
	script: string;
	/** Bundled weights, e.g. ["400", "700"]. */
	weights: string[];
	/** Bundled styles, e.g. ["normal", "italic"]. */
	styles: string[];
	/** Preview text rendered in the icon gallery. */
	sample: string;
}

/** The Icon Pack's font catalog — registered so plugins can list offline fonts. */
export interface FontCatalog {
	families: FontFamilyInfo[];
}

/**
 * What a runtime UI plugin's bundle exports. Loaded by the host at runtime via
 * blob-import; each contribution is optional — a plugin contributes only what
 * it exports. `SettingsSection` is a React component (the host bridge provides
 * React), hence the loose typing on the wire.
 */
export interface PluginBundleExports {
	/** Main view component rendered at /plugin/<id>. */
	default?: unknown;
	/** Sidebar nav items. */
	navItems?: PluginNavItem[];
	/** Settings page section component. */
	SettingsSection?: unknown;
	/** In-app docs section about this plugin. */
	docsSection?: DocsSection;
	/** Custom theme(s). */
	themes?: PluginTheme[];
	/**
	 * Story reader export panel (v1.8.0) — a React component the Article reader
	 * renders inside its Export dialog. Receives `{ detail, onClose }` where
	 * `detail` is the loaded `ArticleDetail` and `onClose` closes the dialog.
	 * The Story Renderer core plugin is the reference implementation.
	 */
	StoryExports?: unknown;
}

// ──────────────────────────────────────────────────────────────────────────
// LLM usage stats (tokens + requests) — surfaced in Settings
// ──────────────────────────────────────────────────────────────────────────

export interface UsageSummary {
	totalRequests: number;
	totalTokens: number;
	promptTokens: number;
	completionTokens: number;
	failedRequests: number;
	/** Token spend per operation kind. */
	byOperation: Record<string, { requests: number; tokens: number }>;
	/** Token spend per provider kind. */
	byProvider: Record<string, { requests: number; tokens: number }>;
	/** Last 30 days roll-up. */
	last30d: { requests: number; tokens: number };
	windowStart: string; // ISO date of the earliest event counted
}

export interface SearchHit {
	article: Article;
	score: number;
	highlight: string;
}

export interface SearchResult {
	query: string;
	hits: SearchHit[];
	totalMatches: number;
}

/**
 * Ask-AI (RAG) result. `answer` carries `[N]` markers resolved against
 * `citations`; `hits` is the underlying cited-article list.
 */
export interface AskResult {
	query: string;
	answer: string;
	citations: Citation[];
	hits: SearchHit[];
	tokensUsed: number;
}

// ──────────────────────────────────────────────────────────────────────────
// Article layer
// ──────────────────────────────────────────────────────────────────────────

export interface Article {
	id: string;
	sourceId: string;
	title: string;
	/** Original title before translation, if the title was translated. */
	originalTitle?: string | null;
	content: string;
	/**
	 * Translated body (Translate Stories) — AI translation of `content` into the
	 * user's intelligence language. `content` remains the canonical original;
	 * this is what the reader shows by default (with an Original toggle) when set.
	 */
	translatedContent?: string | null;
	/**
	 * The source's publication language (ISO 639-1, from `sources.language`).
	 * NULL/absent = unknown — the translate pill can't judge whether a story is
	 * already in the user's language, so it stays available. When set and equal
	 * to the user's intelligence language, the engine skips translation and the
	 * UI hides the Translate pill (v1.8.0).
	 */
	language?: string | null;
	url: string;
	author: string | null;
	publishedAt: Date | null;
	collectedAt: Date;
	/** SHA-256 of normalized (title + publishedAt + sourceId) for dedup. */
	hash: string;
	/**
	 * Archive spine id (`content_items`). Present once the engine has linked
	 * this article to its archive item — the frontend bookmark button sends
	 * this to `POST /bookmarks`. Null for rows created before v1.6.0 migration
	 * or when the spine has not been attached.
	 */
	contentItemId?: string | null;
	/**
	 * Content-quality signals (v1.8.0) — the engine's heuristics so the UI can
	 * offer Re-collect / Re-translate honestly instead of hiding damage.
	 * `contentCorrupted`: the stored body carries extraction junk (inline JSON,
	 * media-player chrome). `contentClean`: a read-time cleanup of that junk so
	 * the story's real prose is readable (never persisted; the stored content
	 * stays canonical). `translationIncomplete`: the body translation is
	 * missing, truncated, or carries leftover placeholders.
	 */
	contentCorrupted?: boolean;
	contentClean?: string;
	translationIncomplete?: boolean;
}

/**
 * Single article + its source name, returned by `GET /articles/:id`.
 * The reader page needs the human-readable source name alongside the article.
 */
export interface ArticleDetail {
	article: Article;
	/** Resolved from `sources.name` via `article.sourceId`. */
	sourceName: string | null;
	sourceCategory: SourceCategory | null;
}

/**
 * A content payload the Story Renderer (and any exporter plugin) can turn into
 * Markdown / themed HTML / a screenshot (v1.8.0). Generalized beyond the
 * article reader so Ask-AI answers, search results, history entries, period
 * briefings, and insights can all be exported the same way.
 */
export interface ExportableContent {
	/** What's being exported — lets renderers differ (v1.8.0). */
	kind: "article" | "insight" | "other";
	title: string;
	/** The primary text to export (the original body, the answer, the summary). */
	body: string;
	/** A translated variant of `body` — used when the exporter prefers it. */
	translatedBody?: string;
	/** v1.8.0 — the labeled insight triad, present when `kind === "insight"`. */
	insight?: {
		significance: string;
		impact: string;
		recommendedAction: string;
	};
	/** v1.8.0 — the same analysis in the story's source language (bilingual
	 * generation), exported alongside the user-language `insight`. */
	insightOriginal?: {
		significance: string;
		impact: string;
		recommendedAction: string;
	};
	url?: string;
	source?: string;
	author?: string;
	publishedAt?: Date | string | null;
}

// ── Article media ──────────────────────────────────────────────────────────
// Media (images/video) for an article. By default media is fetched on-demand
// from the original source URL (never stored). The user can opt to "keep" an
// item locally — then the engine downloads the bytes to disk and serves them.

export type MediaKind = "image" | "video";

export interface ArticleMedia {
	id: string;
	articleId: string;
	/** Original source URL (always the canonical reference). */
	url: string;
	kind: MediaKind;
	/** Where the bytes come from right now. */
	source: "local" | "remote";
	/** Filesystem path when kept locally; null when remote. Opaque to clients. */
	localPath: string | null;
	/** Bytes on disk when kept locally; null when remote. */
	bytes: number | null;
	mime: string | null;
	caption: string | null;
	/** When the user opted to keep this locally, or null. */
	keptAt: Date | null;
	fetchedAt: Date;
}

/** Body for `POST /articles/:id/media/keep`. */
export interface SetMediaKeepInput {
	url: string;
	keep: boolean;
}

/** Body for `POST /articles/:id/media/keep-all`. */
export interface SetMediaKeepAllInput {
	keep: boolean;
}

/** One locally-kept media item, as listed on the Media dashboard (v1.8.0). */
export interface LocalMediaItem {
	id: string;
	kind: MediaKind;
	/** Original source URL (canonical reference). */
	url: string;
	mime: string | null;
	/** Bytes on disk. */
	bytes: number | null;
	/** Extracted alt/caption text, when the source provided one. */
	caption: string | null;
	/** ISO date the item was kept locally. */
	keptAt: string;
}

/** One row of the Media management dashboard (`GET /media/local`). */
export interface LocalMediaArticle {
	articleId: string;
	articleTitle: string;
	/**
	 * The original title before translation, when the story was translated
	 * (v1.8.0). Attribution credit on downloads must cite the actual published
	 * title, so the desktop uses `articleOriginalTitle ?? articleTitle`.
	 */
	articleOriginalTitle: string | null;
	/** The article's canonical URL (attribution credit on downloads). */
	articleUrl: string;
	sourceName: string | null;
	/** ISO date the article was collected. */
	collectedAt: string;
	/** Number of media items kept locally for this article. */
	itemCount: number;
	/** Total bytes on disk for this article. */
	bytes: number;
	/** The kept items themselves (v1.8.0) — per-item download + attribution. */
	items: LocalMediaItem[];
}

export interface LocalMediaSummary {
	/** All articles that have at least one locally-kept media item. */
	articles: LocalMediaArticle[];
	totalBytes: number;
	totalItems: number;
}

// ──────────────────────────────────────────────────────────────────────────
// Intelligence layer
// ──────────────────────────────────────────────────────────────────────────

/** Importance tiers used for badge color mapping in the UI. */
export type ImportanceTier = "signal" | "trend" | "low-noise";

/**
 * Groups related articles into one intelligence event (project-details.md §21).
 * "New AI Model Released" → official announcement + news + discussion.
 */
export interface ArticleCluster {
	id: string;
	title: string;
	category: SourceCategory;
	articleIds: string[];
	createdAt: Date;
}

export interface Insight {
	id: string;
	clusterId: string | null;
	articleId: string | null;
	summary: string;
	/** "Why it matters." */
	significance: string;
	/** Consequence / blast radius. */
	impact: string;
	importanceScore: number;
	importanceTier: ImportanceTier;
	category: SourceCategory;
	recommendedAction: string;
	/** Language the AI generated this insight in (independent of source). */
	generatedLanguage: string;
	/** v1.8.0 — the insight text as first written, before a translation rewrote
	 * it (mirrors `Article.originalTitle`). Null for a freshly generated or
	 * regenerated insight; populated by the first translation. */
	originalSummary: string | null;
	originalSignificance: string | null;
	originalImpact: string | null;
	originalRecommendedAction: string | null;
	createdAt: Date;
}

// ──────────────────────────────────────────────────────────────────────────
// Report layer
// ──────────────────────────────────────────────────────────────────────────

export type ReportKind = "daily" | "weekly" | "monthly";

/** Time-range scopes the Brief / summary endpoints accept. */
export type BriefPeriod = "today" | "week" | "month" | "all";

export interface Report {
	id: string;
	kind: ReportKind;
	/** Inclusive day this report covers (YYYY-MM-DD). */
	periodStart: string;
	periodEnd: string;
	insightIds: string[];
	language: string;
	createdAt: Date;
}

/**
 * One cohesive LLM briefing over a whole time period (week/month).
 * Produced by `POST /reports/summarize?period=`.
 */

/**
 * A single citation referenced by `[N]` markers inside an LLM-generated
 * summary or answer. The frontend renders `[N]` as a hoverable chip whose
 * tooltip shows the source story; clicking opens the original article URL.
 *
 * The model emits `[N]` tokens; the backend resolves N → this object using
 * the article context it packed into the prompt.
 */
export interface Citation {
	/** The `[N]` number the model used (1-based). */
	n: number;
	articleId: string;
	title: string;
	/** Source name (e.g. "Hugging Face Blog"). */
	sourceName: string;
	/** Original article URL — opened on click. */
	url: string;
	/** ISO date or null. */
	publishedAt: string | null;
}

export interface PeriodSummary {
	period: BriefPeriod;
	/** Headline sentence — the single most important thing this period. */
	headline: string;
	/**
	 * Top themes observed in the period. When LLM-generated (the default for
	 * summarize runs), each carries a one-sentence `rationale` explaining the
	 * semantic through-line and `count` is omitted. When falling back to
	 * category counts (model omitted themes), `count` is set and `rationale`
	 * is omitted. Both fields are optional for backward compatibility.
	 */
	themes: { name: string; count?: number; rationale?: string }[];
	/** Why it matters + impact, distilled. Each may carry `[N]` citations. */
	takeaways: string[];
	/** Concrete next steps. May carry `[N]` citations. */
	recommendedActions: string[];
	/** Citations referenced anywhere in this summary, keyed by their `[N]`. */
	citations: Citation[];
	storyCount: number;
	/** v1.8.0 — bilingual summary. The language of the ORIGINAL version
	 * (majority of the summary's stories, or the user's setting); null when no
	 * separate original exists (single-language summary). The translated
	 * version is the user's AI output language (the fields above). */
	originalLanguage?: string | null;
	originalHeadline?: string;
	originalThemes?: { name: string; count?: number; rationale?: string }[];
	originalTakeaways?: string[];
	originalRecommendedActions?: string[];
}

/**
 * One ranked row in the Brief list — **news-first**.
 *
 * `article` is always present (collected from a source). `insight` is present
 * only when an LLM provider is configured and has analyzed this article. This
 * is what makes Vorynth useful with zero configuration: open the app, read
 * fresh multi-source news; add an API key later and the intelligence triad
 * (why it matters / impact / recommended action) layers on top.
 */
export interface BriefEntry {
	rank: number;
	/** The underlying article. Always present. */
	article: Article;
	/** Category, resolved from the article's source. */
	category: SourceCategory;
	/** Names of sources that surfaced this story. */
	sourceNames: string[];
	/** Deterministic freshness/relevance score (0–10). Always present. */
	score: number;
	/** Importance tier derived from `score` when no LLM is configured. */
	importanceTier: ImportanceTier;
	/**
	 * Transparency — the stored signals behind `score` (evidence, never an
	 * AI-generated explanation of its own reasoning). Same formula the news
	 * layer uses: `reliability * 0.6 + freshness * 2 + lengthSignal`.
	 */
	ranking: {
		sourceReliability: number;
		freshnessScore: number;
		lengthSignal: number;
	};
	/** AI-generated intelligence. Present only when an LLM analyzed this article. */
	insight: Insight | null;
}

export interface TodaysBrief {
	report: Report | null;
	entries: BriefEntry[];
	totalStories: number;
	totalSources: number;
	/** True when an LLM provider is configured and reachable. */
	intelligenceEnabled: boolean;
	generatedAt: Date | null;
}

/**
 * Single source of truth for the current Vorynth release version.
 *
 * Bump it here once when cutting a release — every consumer (the engine's
 * `/status` endpoint, the Settings page, the Changelog) reads this same
 * constant so they never drift.
 */
export const VORYNTH_VERSION = "1.8.1";

/** Engine status surfaced to the UI (e.g. onboarding, settings). */
export interface EngineStatus {
	ready: boolean;
	version: string;
	llm: {
		configured: boolean;
		providerKind: string | null;
		mode: "intelligence" | "news";
	};
	sources: {
		total: number;
		enabled: number;
	};
	articles: {
		total: number;
	};
}

// ──────────────────────────────────────────────────────────────────────────
// Storage & resource usage (v1.8.0)
// ──────────────────────────────────────────────────────────────────────────

/** One on-disk "library" under the Vorynth data directory (`GET /usage`). */
export interface UsageLibrary {
	/** Stable key: `database` | `media` | `backups` | `plugins`. */
	key: string;
	/** Total bytes on disk for this library. */
	bytes: number;
	/** Item count when it means something (kept media, backups, plugins). */
	items?: number;
}

/** Story (article) storage summary. */
export interface UsageStories {
	/** Rows in the articles table. */
	total: number;
	/** Approximate bytes of story text (title + content + translation). */
	contentBytes: number;
}

/** Resource usage of the core-engine process itself. */
export interface UsageProcess {
	/** Resident set size — the RAM the engine actually holds. */
	rssBytes: number;
	heapTotalBytes: number;
	heapUsedBytes: number;
	/** Engine CPU utilization over the sample window (0..N, >100 with threads). */
	cpuPercent: number;
	uptimeSeconds: number;
	/** ISO time the engine process started. */
	startedAt: string;
}

/** Host machine totals for context. */
export interface UsageSystem {
	totalMemBytes: number;
	freeMemBytes: number;
	cpuModel: string;
	cpuCores: number;
}

/** Full storage + resource snapshot shown in Settings → Storage & Usage. */
export interface UsageStats {
	/** Absolute path of the data directory (display only, not actionable). */
	dataDir: string;
	/** Total bytes of everything under the data directory. */
	totalBytes: number;
	/** Per-library breakdown; the sum approximates totalBytes. */
	libraries: UsageLibrary[];
	stories: UsageStories;
	process: UsageProcess;
	system: UsageSystem;
	/** ISO time the snapshot was measured. */
	measuredAt: string;
}

/** Result of `DELETE /stories` — the "clear all stories" action. */
export interface ClearStoriesResult {
	/** Stories removed. */
	deleted: number;
	/** Bookmarked stories kept (R-A10 — user-owned references survive). */
	keptBookmarked: number;
	/** Stories inside a collection kept (user organization survives). */
	keptInCollections: number;
	/** Approximate bytes of story text freed. */
	freedContentBytes: number;
}

// ──────────────────────────────────────────────────────────────────────────
// User profile
// ──────────────────────────────────────────────────────────────────────────

/** Two independent language systems (project-details.md §22). */
export interface UserProfile {
	id: string;
	/** UI strings language (en, fa, es, de, fr, ja, …). */
	preferredUiLanguage: string;
	/** AI output language, independent of source language. */
	preferredIntelligenceLanguage: string;
	topics: SourceCategory[];
	interests: string[];
	notificationSettings: NotificationSettings;
	aiPreferences: AiPreferences;
	/** Display name components — editable from Profile. */
	firstName: string | null;
	lastName: string | null;
	/** Optional handle/alias shown when the user prefers not to use real name. */
	alias: string | null;
	/**
	 * Education + experience (v1.9.0) — what the user studies/does. Collected
	 * today; a future feature will suggest sources, categories, and tags
	 * matched to them (all categories stay accessible).
	 */
	fieldOfStudy: string | null;
	/** Degree-level slug: high-school | associate | bachelor | master | phd | other. */
	degreeLevel: string | null;
	/** Experience-level slug: beginner | intermediate | advanced | expert. */
	experienceLevel: string | null;
	/**
	 * Free-form custom instruction that biases LLM outputs based on what the
	 * app knows about the user. Currently applied to Ask-AI search and the
	 * generate operations (behavior summary, improve-instruction).
	 */
	customInstruction: string;
	/** The user's last LLM-generated behavior summary, or empty. */
	behaviorSummary: string;
	/** When {@link behaviorSummary} was last (re)generated, or null. */
	summaryGeneratedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

/** Fields the user may submit when updating their profile. */
export type UpdateUserProfileInput = {
	firstName?: string | null;
	lastName?: string | null;
	alias?: string | null;
	/** Education + experience (v1.9.0) — see `UserProfile`. */
	fieldOfStudy?: string | null;
	degreeLevel?: string | null;
	experienceLevel?: string | null;
	preferredUiLanguage?: string;
	preferredIntelligenceLanguage?: string;
	customInstruction?: string;
	topics?: SourceCategory[];
	interests?: string[];
};

/** Result of `POST /profile/generate-summary`. */
export interface GenerateSummaryResult {
	summary: string;
	generatedAt: Date;
	tokensUsed: number;
}

/** Result of `POST /profile/improve-instruction`. The original is preserved. */
export interface ImproveInstructionResult {
	original: string;
	improved: string;
	tokensUsed: number;
}

export interface NotificationSettings {
	dailyBriefEnabled: boolean;
	highSignalOnly: boolean;
	quietHoursStart: string | null; // "HH:mm"
	quietHoursEnd: string | null; // "HH:mm"
}

export interface AiPreferences {
	providerId: string | null;
	model: string | null;
	temperature: number;
}

// ──────────────────────────────────────────────────────────────────────────
// LLM providers
// ──────────────────────────────────────────────────────────────────────────

export type LlmProviderKind = "gemini" | "openai" | "anthropic" | "ollama";

export interface LlmProviderConfig {
	id: string;
	kind: LlmProviderKind;
	label: string;
	/** Encrypted at rest by the engine; opaque to the frontend. */
	apiKeyStored: boolean;
	defaultModel: string | null;
	baseUrl: string | null; // for ollama / self-hosted
	enabled: boolean;
}

export interface SaveLlmProviderInput {
	kind: LlmProviderKind;
	label: string;
	apiKey?: string;
	defaultModel?: string;
	baseUrl?: string;
	enabled?: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// Workflow progress (Analyzing screen, streamed via SSE)
// ──────────────────────────────────────────────────────────────────────────

export type WorkflowNodeName =
	| "collector"
	| "normalizer"
	| "dedup"
	| "classifier"
	| "ranker"
	| "analyzer"
	| "localizer"
	| "report";

export type WorkflowNodeStatus = "pending" | "running" | "done" | "error";

export interface WorkflowProgressEvent {
	runId: string;
	node: WorkflowNodeName;
	status: WorkflowNodeStatus;
	/** e.g. "fetched 47 articles", "ranked 12 clusters". */
	detail?: string;
	timestamp: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Background jobs (collect / generate / summarize run server-side so they
// survive navigation away from the page that started them)
// ──────────────────────────────────────────────────────────────────────────

export type JobKind =
	| "collect"
	| "generate"
	| "summarize"
	| "regenerate"
	| "translate"
	| "translate-one"
	| "recollect-one"
	| "ask"
	| "health-check"
	// v1.8.1 — auto-analyze after collect: generate missing insights.
	| "analyze-missing";
export type JobStatus = "queued" | "running" | "done" | "error" | "canceled";

export interface JobProgress {
	/** Human label, e.g. "Collecting OpenAI Blog…", "Analyzing 12 articles". */
	message: string;
	/** 0..1; -1 when the work can't be quantified. */
	fraction: number;
	/** Counts the engine knows about — surfaced in the tray + usage. */
	itemsDone?: number;
	itemsTotal?: number;
}

export interface Job {
	id: string;
	kind: JobKind;
	label: string;
	status: JobStatus;
	progress: JobProgress;
	/** ISO timestamp when the job started. */
	startedAt: string;
	/** ISO timestamp when the job reached a terminal state, or null. */
	finishedAt: string | null;
	/** Wall-clock duration in ms; only set after a terminal state. */
	durationMs: number | null;
	/** Optional error message when status === "error". */
	error: string | null;
	/** Optional result payload (kind-dependent). */
	result: unknown;
}

export interface JobList {
	active: Job[];
	recent: Job[];
}

// ──────────────────────────────────────────────────────────────────────────
// Generic API helpers
// ──────────────────────────────────────────────────────────────────────────

export interface ApiError {
	statusCode: number;
	message: string;
	details?: unknown;
	/** Structured engine error code (e.g. `LLM_RATE_LIMITED`) — the UI maps it
	 *  to a localized explanation instead of showing the raw message. */
	code?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// History (search + brief) and app settings
// ──────────────────────────────────────────────────────────────────────────

export type SearchMode = "keyword" | "ai";

/** One persisted search-history row (keyword OR Ask AI). */
export interface SearchHistoryEntry {
	id: string;
	query: string;
	mode: SearchMode;
	/** Cached result payload (SearchResult for keyword, AskResult for ai). */
	result: SearchResult | AskResult;
	/** User-editable label. Defaults to the query text. */
	title: string;
	archived: boolean;
	tokensUsed: number;
	/** Hit/source count for the list view. */
	hitCount: number;
	createdAt: string;
	updatedAt: string;
}

/** One persisted brief-history row (a saved period summary). */
export interface BriefHistoryEntry {
	id: string;
	period: BriefPeriod;
	periodStart: string | null;
	periodEnd: string | null;
	/** Cached PeriodSummary payload. */
	result: PeriodSummary;
	title: string;
	archived: boolean;
	storyCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface SearchHistoryList {
	items: SearchHistoryEntry[];
}

export interface BriefHistoryList {
	items: BriefHistoryEntry[];
}

// ── Generated history (Profile LLM generations) ────────────────────────────
// Every time the Profile page generates a behavior summary or improves a
// custom instruction, the result is recorded here so it's revisitable from
// the History drawer's "Generated" scope.

export type GeneratedHistoryKind = "behavior-summary" | "instruction-improve";

export interface GeneratedHistoryEntry {
	id: string;
	kind: GeneratedHistoryKind;
	/** Short human label, e.g. the prompt or a truncated summary of the input. */
	title: string;
	/** The generated text the LLM produced. */
	result: string;
	tokensUsed: number;
	archived: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface GeneratedHistoryList {
	items: GeneratedHistoryEntry[];
}

export interface UpdateHistoryEntryInput {
	title?: string;
	archived?: boolean;
}

// ── Story view history (v1.8.0) ─────────────────────────────────────────────
// What the user opened in each story-reading session: the AI insight page, the
// article, or both. Recorded on every story/insight open; surfaced in the
// Brief page's History tab.

/** What the user saw in one story-opening sitting. */
export type StoryViewScope = "insight" | "article" | "both";

export interface StoryViewEntry {
	id: number;
	articleId: string;
	/** Joined from `articles` at read time (R-A09 — never duplicated). */
	articleTitle: string;
	scope: StoryViewScope;
	/**
	 * v1.8.1 — explicit read state. Opening a story marks its view read; the
	 * reader's "Mark read" button toggles it (PATCH /story-views/:id).
	 */
	read: boolean;
	/** ISO timestamp of the (last) view. */
	viewedAt: string;
}

export interface RecordStoryViewInput {
	articleId: string;
	scope: "insight" | "article";
}

/** v1.8.1 — toggle the read flag on a story view (the "Mark read" button). */
export interface SetStoryViewReadInput {
	read: boolean;
}

export interface StoryViewList {
	views: StoryViewEntry[];
}

/**
 * User-facing app settings backed by the `app_settings` table. Keys are
 * namespaced (e.g. `"history.search.recordAi"`). The frontend reads/writes
 * these via `GET /settings` / `PATCH /settings`.
 */
export type AppSettings = Record<string, unknown> & {
	/** Save Ask-AI queries to search history (costs tokens — on by default). */
	"history.search.recordAi"?: boolean;
	/** Save keyword queries to search history (off by default). */
	"history.search.recordKeyword"?: boolean;
	/**
	 * Show the "support the author" reminder before opening an article in the
	 * native reader (on by default; dismissible with "don't show again").
	 */
	"reader.supportAuthorReminder"?: boolean;
	/**
	 * Show the one-time privacy/policy disclaimer before the first media
	 * download (v1.8.0 — on by default; "don't show again" turns it off and
	 * the Media section in Settings turns it back on).
	 */
	"media.showDownloadWarning"?: boolean;
	/**
	 * When true, newly-fetched media is kept locally by default instead of
	 * being streamed from the source URL each time.
	 */
	"reader.defaultKeepMediaLocal"?: boolean;
	/**
	 * v1.6.0 — auto-delete retention. Days of age (by collected time) after
	 * which a story is automatically removed. 0 = off (no auto-delete).
	 */
	"retention.autoDeleteDays"?: number;
	/**
	 * When true, auto-delete never removes bookmarked stories (R-A10).
	 * Default true.
	 */
	"retention.protectBookmarked"?: boolean;
	/**
	 * When true, auto-delete never removes stories placed in a collection
	 * (folders/categories are user organization). Default true.
	 */
	"retention.protectInCollection"?: boolean;
	/**
	 * User's choice: intelligence mode (LLM on) or news mode (LLM off).
	 * The user explicitly controls this, regardless of whether providers exist.
	 */
	"engine.mode"?: "intelligence" | "news";
	/**
	 * The ID of the provider the user explicitly selected as active, when
	 * multiple providers are configured. If absent or the provider no longer
	 * exists, the most recent enabled provider is used as fallback.
	 */
	"engine.activeProviderId"?: string;
	/**
	 * Show confirmation dialog before deleting an LLM provider.
	 * Default true; the user can disable it with "don't show again".
	 */
	"ui.confirmDeleteProvider"?: boolean;
	/**
	 * v1.8.0 — background mode. When true, closing the window hides Vorynth to
	 * the system tray instead of quitting: the engine keeps collecting in the
	 * background and the tray (or a new launch) brings the window back. Quit
	 * from the tray to fully exit. Default false.
	 */
	"ui.backgroundMode"?: boolean;
	/**
	 * v1.8.0 — launch at login. When true, Vorynth starts automatically when
	 * the user signs in to the computer (macOS: Login Items via a LaunchAgent;
	 * Windows: Startup apps via the Run key; Linux: Startup Applications via an
	 * XDG .desktop file). Default false.
	 */
	"ui.launchAtStartup"?: boolean;
	/**
	 * v1.8.0 — start without a window. When true, Vorynth launches straight
	 * to the menu bar/tray with no window (read by the Tauri shell at startup,
	 * so the window is created invisible — no flash). The tray or Dock brings
	 * it back. Default false.
	 */
	"ui.startHidden"?: boolean;
	/**
	 * v1.7.0 — trash retention value (numeric part). Combined with
	 * `trash.retentionUnit`. 0 = keep in trash until the user empties it.
	 * Default 7 (days).
	 */
	"trash.retentionValue"?: number;
	/**
	 * v1.7.0 — trash retention unit for `trash.retentionValue`.
	 * months = 30 days, years = 365 days (approximate, retention only).
	 */
	"trash.retentionUnit"?: "days" | "weeks" | "months" | "years";
	/**
	 * v1.8.0 — source lists. When true (default), 18+ (NSFW) community lists
	 * are hidden from browsing on the Sources page until the user explicitly
	 * opts to show them. The list itself is never deleted either way.
	 */
	"sourceLists.hideAdult"?: boolean;
	/**
	 * v1.8.0 — data health check. When true (default), a background job runs
	 * daily and self-heals stored articles: it fetches the full text of
	 * snippet-only stories, repairs stale translations, and (when Intelligence
	 * mode is on) generates the missing AI insights. Turn off to stop the
	 * automatic run — "Run data check now" still works on demand.
	 */
	"dataHealth.autoCheck"?: boolean;
	/**
	 * v1.8.0 — which story-reader footer actions sit in the primary bar
	 * (`markRead | save | recollect | share | export | openOriginal | back`);
	 * anything not listed is reachable behind the "More ⋮" menu. Empty/missing
	 * falls back to the default pinned set. Customizable in Profile.
	 */
	"ui.readerPinnedActions"?: string[];
	/**
	 * v1.8.1 — the story-reader footer action ORDER (article + insight pages):
	 * ids from the canonical list, drag-reordered on the Profile page. Missing
	 * → the canonical order.
	 */
	"ui.readerActions"?: string[];
	/**
	 * v1.8.1 — story-reader footer actions to hide behind the "More ⋮" menu
	 * (ids from `ui.readerActions`). Missing → the legacy
	 * `ui.readerPinnedActions` (all non-pinned ids), else the default set.
	 */
	"ui.readerActionsInMore"?: string[];
	/**
	 * v1.8.0 — story-card click behavior. When true (default), dragging the
	 * mouse over a brief card selects text and does NOT open the story — a
	 * clean click is required. Turn off to open the story on any press-release,
	 * even after a selection drag (for users who never select with the mouse).
	 */
	"ui.dragSelectsText"?: boolean;
	/**
	 * v1.8.0 — advanced features. When true, the Plugins page appears in the
	 * sidebar and its route is reachable (the plugin/connector surface is
	 * engineering territory). Default false — non-technical users never see
	 * "plugin" terminology; source connectors resolve invisibly.
	 */
	"ui.showAdvancedFeatures"?: boolean;
	/**
	 * v1.8.1 — whether the Plugins page is shown. Separate from the advanced
	 * gate: a user can enable advanced features for the Developer section
	 * without seeing plugin machinery. Default true.
	 */
	"ui.showPlugins"?: boolean;
	/**
	 * v1.8.1 — network access (Settings → Advanced → Developer). "local"
	 * (default) keeps the engine on 127.0.0.1 with CORS for the app
	 * itself only. "all" binds 0.0.0.0 and opens CORS to any origin (reachable
	 * from every device on the network). "custom" binds 0.0.0.0 but CORS only
	 * allows `network.allowedIps` alongside 127.0.0.1.
	 */
	"network.accessMode"?: "local" | "all" | "custom";
	/**
	 * v1.8.1 — comma-separated IPs allowed alongside 127.0.0.1 when
	 * `network.accessMode` is "custom" (e.g. "192.168.9.160,10.0.0.5").
	 */
	"network.allowedIps"?: string;
	/**
	 * v1.8.1 — ids of dismissed contextual tips (see `DismissibleTip`).
	 * An empty/missing array shows every tip once.
	 */
	"ui.tipsDismissed"?: string[];
	/**
	 * v1.8.1 — text labels next to the top-bar icons (History / theme /
	 * Notifications). Default true; turn off for a compact header.
	 */
	"ui.showHeaderLabels"?: boolean;
	/**
	 * v1.8.1 — where the Archive sub-pages live. "sidebar" (default): an
	 * expandable Archive submenu in the sidebar; "inpage": the in-page tab row
	 * on the Archive page (the pre-1.8.1 behavior).
	 */
	"ui.archiveNavMode"?: "sidebar" | "inpage";
	/**
	 * v1.9.0 — the story-card footer action order (Settings → General → Story
	 * card actions). The four ids are `readSource` (the "Read source" link),
	 * `viewToggle` (Article ⇄ Insights), `markRead` (the Mark-read button) and
	 * `save` (Save/Bookmark). The footer renders them in this order; the More
	 * button always stays last. Missing → all four in the default order.
	 */
	"ui.briefActions"?: string[];
	/**
	 * v1.9.0 — which story-card footer actions live behind the "More ⋮" menu
	 * instead of the primary bar (ids from `ui.briefActions`). Missing → none.
	 */
	"ui.briefActionsInMore"?: string[];
};

// ──────────────────────────────────────────────────────────────────────────
// Network access (v1.8.1 — Settings → Advanced → Developer)
// ──────────────────────────────────────────────────────────────────────────

export type NetworkAccessMode = "local" | "all" | "custom";

/**
 * Resolved engine network access, from `GET /network`. The Developer settings
 * section displays this (backend URL, LAN addresses) and edits the two
 * app_settings keys that drive it.
 */
export interface NetworkInfo {
	/** "local" (loopback only) · "all" (0.0.0.0, any origin) · "custom" (0.0.0.0 + allowlisted IPs). */
	accessMode: NetworkAccessMode;
	/** Comma-split IPs currently allowlisted in `network.allowedIps`. */
	allowedIps: string[];
	/** The host the engine listens on (127.0.0.1 or 0.0.0.0). */
	host: string;
	port: number;
	/** Detected non-loopback IPv4 addresses of this machine. */
	lanIps: string[];
	/** The local backend URL, e.g. "http://127.0.0.1:34117". */
	backendUrl: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Archive (v1.6.0) — unified user-owned intelligence space
// ──────────────────────────────────────────────────────────────────────────
// The Archive is Vorynth's user-owned organization layer: collected stories,
// bookmarked items, generated summaries, keyword searches, and Ask-AI answers
// are all `content_items` (metadata-only spines) whose real data lives in the
// origin tables (R-A09). Bookmarks are a flag on a content item, not a type
// (R-A10).

export type ContentItemType =
	"article" | "summary" | "keyword-search" | "ai-ask";

export type CollectionKind = "category" | "folder";

/** One row of the Archive list (`GET /archive/items`). */
export interface ArchiveItem {
	contentItemId: string;
	contentType: ContentItemType;
	/** Free-form user note (searchable in the Archive). */
	note: string | null;
	/** Owning collection id, or null = uncategorized. */
	collectionId: string | null;
	/** ISO timestamp when the user archived the item, or null. */
	archivedAt: string | null;
	bookmarked: boolean;
	tags: string[];
	createdAt: string;
	updatedAt: string;
	/** Origin-derived display fields (joined per kind — no stored snapshot). */
	title: string | null;
	/** The pre-translation source title (v1.8.0) — null for non-article items. */
	originalTitle: string | null;
	url: string | null;
	author: string | null;
	publishedAt: string | null;
	/** Full origin payload (Article, SearchHistoryEntry, BriefHistoryEntry, …). */
	origin: unknown;
}

export interface ArchiveItemList {
	items: ArchiveItem[];
	total: number;
	hasMore: boolean;
}

/** Body for `PATCH /archive/items/:id`. `archived` toggles the flag. */
export interface UpdateArchiveItemInput {
	note?: string | null;
	tags?: string[];
	collectionId?: string | null;
	archived?: boolean;
}

export interface Collection {
	id: string;
	name: string;
	description: string | null;
	/** Parent collection id (category → folder → folder/items nesting). */
	parentId: string | null;
	kind: CollectionKind;
	/** True when a future LLM-organization job proposed this collection. */
	llmGenerated: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface CreateCollectionInput {
	name: string;
	kind?: CollectionKind;
	parentId?: string | null;
	description?: string;
}

export interface UpdateCollectionInput {
	name?: string;
	description?: string;
	parentId?: string | null;
	kind?: CollectionKind;
}

export interface CollectionList {
	items: Collection[];
}

/** One saved content item — the flag that makes it "Saved". */
export interface Bookmark {
	id: string;
	contentItemId: string;
	createdAt: string;
}

/** `GET /bookmarks` — bookmarked items, same shape as archive items. */
export interface BookmarkList {
	items: ArchiveItem[];
	total: number;
	hasMore: boolean;
}

// ── Trash (v1.7.0) — soft-deleted collections & history ─────────────────────
// Deleting a collection or a history entry soft-deletes it (goes to Trash,
// hidden from the live view, restorable). After `trash.retentionValue` ×
// `trash.retentionUnit` it is auto-purged (bookmarked history items are never
// auto-purged — R-A10). Permanent deletion only happens from the Trash page.

export type TrashKind = "collection" | "search" | "brief" | "generated";

/** One row of the unified Trash list (`GET /trash`). */
export interface TrashEntry {
	/** Origin id: a collection id, or a search/brief/generated history id. */
	id: string;
	kind: TrashKind;
	/** Collection name, or the history entry's title. */
	name: string;
	/** ISO timestamp when it was soft-deleted. */
	deletedAt: string;
	/** Human hint, e.g. "Category · 2 folders · 5 items" (collections only). */
	subtitle?: string;
	/** How many bookmarked items would be destroyed by a permanent delete. */
	bookmarkedCount: number;
}

export interface TrashList {
	items: TrashEntry[];
}

/** Body for `POST /trash/restore`. */
export interface RestoreTrashInput {
	kind: TrashKind;
	id: string;
}

/** Body for `POST /trash/purge` — permanent delete of one entry. */
export interface PurgeTrashInput {
	kind: TrashKind;
	id: string;
	/**
	 * Required when the entry contains bookmarked items (else 409
	 * BOOKMARKED_ITEMS_EXIST) — the UI confirms this explicitly first.
	 */
	force?: boolean;
}

/** Body for `POST /trash/empty` — permanent delete of everything in trash. */
export interface EmptyTrashInput {
	force?: boolean;
}

// ── Sources: per-source article range windows ───────────────────────────────
// `GET /sources/:id/articles?range=day|week|month|year|from&to=`. Informational
// over surviving data — articles pruned by the source's retention window are
// gone from the DB, and `prunedNote` explains why a window comes up empty.

export type SourceRange = "day" | "week" | "month" | "year" | "custom";

export interface SourceArticlesResult {
	articles: Article[];
	total: number;
	/** Human explainer when the requested range predates retention, else null. */
	prunedNote: string | null;
}

// ── History unified search ─────────────────────────────────────────────────
// `GET /history/search?q=` across search/brief/generated tables. `type`
// selects which existing full-detail page to open for a hit.

export type HistoryType = "search" | "brief" | "generated";

export interface HistorySearchHit {
	id: string;
	type: HistoryType;
	title: string;
	createdAt: string;
	archived: boolean;
	/** Short match snippet for context. */
	snippet: string;
}

export interface HistorySearchResult {
	items: HistorySearchHit[];
}

// ── Advanced researcher search (Should tier) ────────────────────────────────
// Structured query over the collected corpus: domains, importance tiers, date
// range, authors, sources, and whether an AI insight exists. Powers the Brief
// page's "Advanced search" panel.

export interface AdvancedSearchQuery {
	q?: string;
	domains?: SourceCategory[];
	importance?: ImportanceTier[];
	/** ISO date (inclusive) — filters on collected_at. */
	from?: string;
	to?: string;
	authors?: string[];
	sources?: string[];
	hasInsight?: boolean;
	limit?: number;
}
