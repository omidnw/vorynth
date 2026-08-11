import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type {
	SourceAuthority,
	SourceListSourceDefinition,
	SourceScope,
} from "@vorynth/types";
import { normalizeText } from "../search/text-normalizer.js";
import { ensureFtsSchema } from "./fts-sync.js";
import { sweepOrphanSpines } from "./spine.js";
import {
	DEVELOPER_SEED_LIST,
	DEVELOPER_SEED_SOURCES,
} from "./developer-seed.generated.js";

/**
 * Idempotent DDL — every statement starts with CREATE TABLE IF NOT EXISTS so
 * re-runs are harmless. Keep in sync with the Drizzle schema.
 */
export const DDL = `
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'rss',
  category TEXT NOT NULL DEFAULT 'other',
  adapter TEXT NOT NULL DEFAULT 'rss',
  list_id TEXT,
  country TEXT,
  city TEXT,
  language TEXT,
  tags TEXT,
  configuration TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  fetch_window_days INTEGER NOT NULL DEFAULT 7,
  last_checked_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- v1.8.0 — curated source lists. Official lists seed in-app code (trusted);
-- community lists are contributed through the GitHub repo and cached here in
-- sources_json (the offline catalog — a failed refresh never clears it).
-- The enabled flag is the master switch: off hides the list's sources from the
-- page AND the crawler, rows kept (re-enabling restores them with edits intact).
CREATE TABLE IF NOT EXISTS source_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT 'official',
  nsfw INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  version TEXT,
  sources_json TEXT NOT NULL DEFAULT '[]',
  curator TEXT,
  updated_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Official connector manifests cached from the GitHub connector registry
-- (v1.8.0, connectors/registry.json). Rows ARE the offline catalog: a failed
-- fetch never clears them. The registry distributes DEFINITIONS (configFields,
-- icon, tier, source mapping); adapter implementations stay compiled in the
-- engine (R-A13).
CREATE TABLE IF NOT EXISTS connector_manifests (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL,
  config_fields TEXT NOT NULL DEFAULT '[]',
  icon TEXT,
  icon_src TEXT,
  tier TEXT NOT NULL DEFAULT 'official',
  min_vorynth_version TEXT,
  updated_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  author TEXT,
  published_at INTEGER,
  collected_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  hash TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_hash ON articles(hash);
CREATE INDEX IF NOT EXISTS idx_articles_collected_at ON articles(collected_at);

CREATE TABLE IF NOT EXISTS article_clusters (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  article_ids TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS ai_insights (
  id TEXT PRIMARY KEY,
  cluster_id TEXT REFERENCES article_clusters(id) ON DELETE SET NULL,
  article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  significance TEXT NOT NULL DEFAULT '',
  impact TEXT NOT NULL DEFAULT '',
  importance_score REAL NOT NULL DEFAULT 0,
  importance_tier TEXT NOT NULL DEFAULT 'low-noise',
  category TEXT NOT NULL DEFAULT 'other',
  recommended_action TEXT NOT NULL DEFAULT '',
  generated_language TEXT NOT NULL DEFAULT 'en',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_insights_created_at ON ai_insights(created_at);
CREATE INDEX IF NOT EXISTS idx_insights_score ON ai_insights(importance_score);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'daily',
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  insight_ids TEXT NOT NULL DEFAULT '[]',
  language TEXT NOT NULL DEFAULT 'en',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS user_profile (
  id TEXT PRIMARY KEY DEFAULT 'default',
  preferred_ui_language TEXT NOT NULL DEFAULT 'en',
  preferred_intelligence_language TEXT NOT NULL DEFAULT 'en',
  topics TEXT NOT NULL DEFAULT '[]',
  interests TEXT NOT NULL DEFAULT '[]',
  notification_settings TEXT NOT NULL DEFAULT '{}',
  ai_preferences TEXT NOT NULL DEFAULT '{}',
  first_name TEXT,
  last_name TEXT,
  alias TEXT,
  field_of_study TEXT,
  degree_level TEXT,
  experience_level TEXT,
  custom_instruction TEXT NOT NULL DEFAULT '',
  behavior_summary TEXT NOT NULL DEFAULT '',
  summary_generated_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS llm_providers (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  encrypted_api_key TEXT,
  default_model TEXT,
  base_url TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  configuration TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS installed_plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'ui',
  type TEXT NOT NULL DEFAULT 'custom',
  contributions TEXT NOT NULL DEFAULT '[]',
  configuration TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  bundle_path TEXT NOT NULL,
  installed_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  provider_kind TEXT NOT NULL,
  model TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  ok INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_operation ON usage_events(operation);

CREATE TABLE IF NOT EXISTS search_history (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  mode TEXT NOT NULL,
  result TEXT NOT NULL,
  title TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  hit_count INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at);
CREATE INDEX IF NOT EXISTS idx_search_history_archived ON search_history(archived);

CREATE TABLE IF NOT EXISTS brief_history (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  period_start INTEGER,
  period_end INTEGER,
  result TEXT NOT NULL,
  title TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  story_count INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_brief_history_created_at ON brief_history(created_at);
CREATE INDEX IF NOT EXISTS idx_brief_history_archived ON brief_history(archived);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS article_media (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  kind TEXT NOT NULL,
  local_path TEXT,
  bytes INTEGER,
  mime TEXT,
  caption TEXT,
  kept_at INTEGER,
  fetched_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_article_media_article_id ON article_media(article_id);
CREATE INDEX IF NOT EXISTS idx_article_media_kept ON article_media(kept_at);

CREATE TABLE IF NOT EXISTS generated_history (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  result TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_generated_history_created_at ON generated_history(created_at);
CREATE INDEX IF NOT EXISTS idx_generated_history_archived ON generated_history(archived);

CREATE TABLE IF NOT EXISTS story_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('insight', 'article', 'both')),
  viewed_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_story_views_article ON story_views(article_id, id);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'folder',
  llm_generated INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_collections_parent ON collections(parent_id);

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('article','summary','keyword-search','ai-ask')),
  note TEXT,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  archived_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_content_items_collection ON content_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(content_type);
CREATE INDEX IF NOT EXISTS idx_content_items_created ON content_items(created_at);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS content_item_tags (
  content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (content_item_id, tag_id)
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  content_item_id TEXT NOT NULL UNIQUE REFERENCES content_items(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- v1.7.0 — background job persistence: jobs survive restarts and resume from
-- their last checkpoint (status 'running'/'queued' rows are restored on boot).
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  fraction REAL NOT NULL DEFAULT 0,
  items_done INTEGER,
  items_total INTEGER,
  input_json TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER,
  error TEXT,
  result_json TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at);
`;

/**
 * Additive ALTER TABLE statements for schema evolution. Errors for
 * "duplicate column" are swallowed so re-runs are safe.
 */
export const ADDITIVE_DDLS = [
	"ALTER TABLE sources ADD COLUMN fetch_window_days INTEGER NOT NULL DEFAULT 7",
	"UPDATE sources SET fetch_window_days = 7 WHERE fetch_window_days = 30",
	"ALTER TABLE user_profile ADD COLUMN first_name TEXT",
	"ALTER TABLE user_profile ADD COLUMN last_name TEXT",
	"ALTER TABLE user_profile ADD COLUMN alias TEXT",
	"ALTER TABLE user_profile ADD COLUMN custom_instruction TEXT NOT NULL DEFAULT ''",
	"ALTER TABLE user_profile ADD COLUMN behavior_summary TEXT NOT NULL DEFAULT ''",
	"ALTER TABLE user_profile ADD COLUMN summary_generated_at INTEGER",
	"ALTER TABLE user_profile ADD COLUMN field_of_study TEXT",
	"ALTER TABLE user_profile ADD COLUMN degree_level TEXT",
	"ALTER TABLE user_profile ADD COLUMN experience_level TEXT",
	"ALTER TABLE article_media ADD COLUMN updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)",
	"ALTER TABLE articles ADD COLUMN original_title TEXT",
	// v1.6.0 — archive spine. Origin tables gain a nullable content_item_id FK
	// (UNIQUE via the indexes below). NOT NULL is enforced at the service
	// layer (R-A01: additive only — no shipped-table rebuild); `ensureSpines`
	// backfills existing rows and repairs gaps on every startup.
	"ALTER TABLE articles ADD COLUMN content_item_id TEXT",
	"ALTER TABLE search_history ADD COLUMN content_item_id TEXT",
	"ALTER TABLE brief_history ADD COLUMN content_item_id TEXT",
	"ALTER TABLE generated_history ADD COLUMN content_item_id TEXT",
	"CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_content_item ON articles(content_item_id)",
	"CREATE UNIQUE INDEX IF NOT EXISTS idx_search_history_content_item ON search_history(content_item_id)",
	"CREATE UNIQUE INDEX IF NOT EXISTS idx_brief_history_content_item ON brief_history(content_item_id)",
	"CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_history_content_item ON generated_history(content_item_id)",
	// v1.6.0 — absolute time range per source (fetch window OR from/to dates).
	"ALTER TABLE sources ADD COLUMN fetch_from INTEGER",
	"ALTER TABLE sources ADD COLUMN fetch_to INTEGER",
	// v1.7.0 — trash / soft-delete. Nullable deleted_at columns: NULL = live,
	// set = soft-deleted (hidden, restorable). History rows keep their spine so
	// no orphan-sweep is needed while trashed (R-A10).
	"ALTER TABLE collections ADD COLUMN deleted_at INTEGER",
	"ALTER TABLE search_history ADD COLUMN deleted_at INTEGER",
	"ALTER TABLE brief_history ADD COLUMN deleted_at INTEGER",
	"ALTER TABLE generated_history ADD COLUMN deleted_at INTEGER",
	// v1.7.0 — Translate Stories. `translated_content` holds the AI translation
	// of the body; `content` stays the canonical original (R-A05).
	"ALTER TABLE articles ADD COLUMN translated_content TEXT",
	// v1.8.0 — plugin security scan. JSON report of the installed plugin's
	// bundle.js static analysis; null until scanned (built-ins never get one).
	"ALTER TABLE installed_plugins ADD COLUMN security_scan TEXT",
	// v1.8.0 — source lists. Sources belong to a curated list (NULL = a
	// user-created "My sources" source). No DB FK — service-enforced.
	"ALTER TABLE sources ADD COLUMN list_id TEXT",
	// v1.8.0 — geography/language tags for grouping (ISO country/language
	// codes + free-text city). Nullable — user rows are untagged until set.
	"ALTER TABLE sources ADD COLUMN country TEXT",
	"ALTER TABLE sources ADD COLUMN city TEXT",
	"ALTER TABLE sources ADD COLUMN language TEXT",
	// v1.8.0 — semantic metadata (the "source intelligence layer" data-holding
	// layer): how broadly the source matters (scope), its credibility class
	// (authority), and the fields it touches (impact_areas, JSON slug array).
	// Nullable — user rows are unclassified until set.
	"ALTER TABLE sources ADD COLUMN scope TEXT",
	"ALTER TABLE sources ADD COLUMN authority TEXT",
	"ALTER TABLE sources ADD COLUMN impact_areas TEXT",
	"ALTER TABLE sources ADD COLUMN tags TEXT",
	// v1.8.0 — insight originals. The ai_insights text as first written, before
	// a translation rewrote it (mirrors articles.original_title). Nullable —
	// only set by the first translation of a generated insight.
	"ALTER TABLE ai_insights ADD COLUMN original_summary TEXT",
	"ALTER TABLE ai_insights ADD COLUMN original_significance TEXT",
	"ALTER TABLE ai_insights ADD COLUMN original_impact TEXT",
	"ALTER TABLE ai_insights ADD COLUMN original_recommended_action TEXT",
	// v1.8.1 — explicit read state on viewed stories. Opening a story marks its
	// view read; the reader's "Mark read" button toggles it. NOT NULL with a
	// DEFAULT so the ALTER works on non-empty tables (existing rows = unread).
	"ALTER TABLE story_views ADD COLUMN read INTEGER NOT NULL DEFAULT 0",
	// v1.8.1 — source-list deletion. A list the user deletes is flagged instead
	// of removed outright (the seed skips deleted lists, so an official list
	// stays gone across restarts — R-A10: nothing silently resurrects).
	"ALTER TABLE source_lists ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0",
	// v1.8.1 — a community list's repo file path (e.g. "sources/security.json"),
	// powering the per-list "Update" button. NULL for official/imported lists.
	"ALTER TABLE source_lists ADD COLUMN repo_path TEXT",
];

/** Seed defaults the freshly migrated database needs to operate. */
export function seedDefaults(db: Database.Database): void {
	// Default user_profile row.
	const exists = db
		.prepare("SELECT COUNT(*) as c FROM user_profile WHERE id = 'default'")
		.get() as { c: number };
	if (exists.c === 0) {
		db.prepare(
			`INSERT INTO user_profile (id, preferred_ui_language, preferred_intelligence_language)
			 VALUES ('default', 'en', 'en')`,
		).run();
	}

	// Default app settings.
	const defaultSettings: Record<string, unknown> = {
		"history.search.recordAi": true,
		"history.search.recordKeyword": false,
		"reader.supportAuthorReminder": true,
		"reader.defaultKeepMediaLocal": false,
		// v1.6.0 — auto-delete retention. 0 = off; days of age before a story is
		// removed. Protections default on (R-A10 / collections are user-owned).
		"retention.autoDeleteDays": 0,
		"retention.protectBookmarked": true,
		"retention.protectInCollection": true,
		// v1.7.0 — trash retention. Value + unit (days/weeks/months/years);
		// 0 = keep in trash until the user empties it. Default 7 days.
		"trash.retentionValue": 7,
		"trash.retentionUnit": "days",
		// v1.8.0 — data health check: daily self-healing job (full text for
		// snippet-only stories, stale-translation repair, missing-insight
		// backfill). On by default; users can turn it off from Settings.
		"dataHealth.autoCheck": true,
		// v1.8.0 — the story-reader footer (article + insight pages): the full
		// action ORDER (drag-reorderable in Profile) + which ones sit behind the
		// "More ⋮" menu. v1.8.1 — the order became a setting; the legacy
		// `ui.readerPinnedActions` (pinned ids only) still seeds older databases.
		"ui.readerActions": [
			"markRead",
			"save",
			"recollect",
			"retranslate",
			"share",
			"export",
			"openOriginal",
			"back",
		],
		"ui.readerActionsInMore": [
			"recollect",
			"retranslate",
			"export",
			"openOriginal",
		],
		// v1.8.0 — the period summary's ORIGINAL version language. "auto" = the
		// majority language of the summary's stories; otherwise a BCP-47 code.
		"intelligence.summaryOriginalLanguage": "auto",
		// v1.8.0 — story-card click behavior. When true (default), dragging the
		// mouse over a card selects text and does NOT open the story — a clean
		// click is required. Off = any press-release on a card opens the story.
		"ui.dragSelectsText": true,
		// v1.8.0 — advanced features. When true, the Plugins page appears in the
		// sidebar and its route is reachable. Default false: source connectors
		// resolve invisibly for non-technical users; "plugin" terminology stays
		// behind the advanced gate.
		"ui.showAdvancedFeatures": false,
		// v1.8.1 — network access (Settings → Advanced → Developer). "local"
		// keeps the engine loopback-only; "all"/"custom" expose it to the
		// network (0.0.0.0) with a CORS allowlist. Allowed IPs are
		// comma-separated and allowed alongside 127.0.0.1.
		"network.accessMode": "local",
		"network.allowedIps": "",
		// v1.8.1 — separate the Plugins page from the advanced gate: a user can
		// enable advanced features for the Developer section without seeing
		// plugin machinery. Default true (advanced still reveals Plugins).
		"ui.showPlugins": true,
		// v1.8.1 — text labels next to the top-bar icons (default on).
		"ui.showHeaderLabels": true,
		// v1.8.1 — Archive sub-pages live in a sidebar submenu by default;
		// "inpage" restores the old in-page tab row (Settings → General → Nav).
		"ui.archiveNavMode": "sidebar",
		// v1.9.0 — story-card footer actions (Settings → General → Story card
		// actions): the full order + which ones sit behind the More ⋮ menu.
		// v1.8.1 — Save (bookmark) is the card's quick action; "Mark read"
		// lives on the reader bar + Viewed-stories history instead.
		"ui.briefActions": ["readSource", "viewToggle", "save"],
		"ui.briefActionsInMore": [],
	};
	const seedSetting = db.prepare(
		"INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",
	);
	for (const [key, value] of Object.entries(defaultSettings)) {
		seedSetting.run(key, JSON.stringify(value));
	}

	// Seed the curated source lists (v1.8.0) before their sources — the list
	// row + cached definitions must exist for enable() to materialize.
	seedSourceLists(db);

	// Seed 13 (now 24) default sources so first-run users have real breadth.
	seedSources(db);

	// Tag seed rows that predate the geography/language columns (guarded:
	// only untagged rows are touched — user edits never overwritten).
	backfillSeedTags(db);

	// Repair seed-source feed URLs that moved since v1.8.0 shipped (guarded:
	// only rows still carrying the exact dead URL are touched — see
	// SEED_URL_REPAIRS).
	repairSeedUrls(db);
}

export interface SeedSource {
	id: string;
	name: string;
	url: string;
	type: string;
	category: string;
	adapter: string;
	configuration: { feedUrl: string };
	/**
	 * Source list this seed belongs to (v1.8.0) — NULL = user-created. Every
	 * official seed belongs to the "developer" list (see SEED_SOURCE_LISTS).
	 */
	listId: string | null;
	/**
	 * Geography/language tags (v1.8.0) — ISO 3166-1 alpha-2 country, free-text
	 * city (null = global/remote), ISO 639-1 language. Shown as badges and used
	 * to group/browse sources by country, city, and language.
	 */
	country: string;
	city: string | null;
	language: string;
	/**
	 * Semantic metadata (v1.8.0) — scope/authority enums + impact-area slugs.
	 * Kept in a separate id-keyed map (`SEED_SOURCE_METADATA`) so a seed row
	 * reads as pure identity; NULL = the source stays unclassified.
	 */
	scope?: SourceScope;
	authority?: SourceAuthority;
	impactAreas?: string[];
}

export const SEED_SOURCES: SeedSource[] = DEVELOPER_SEED_SOURCES;

/**
 * Semantic metadata for the 24 official seed sources (v1.8.0) — keyed by seed
 * id so the seed rows above stay pure identity. These are best-effort curated
 * classifications (scope/authority from the shared enums, impact areas from
 * the suggested vocabulary); a user can correct any of them in the Edit form
 * and their change is never overwritten (guarded backfill).
 */
export const SEED_SOURCE_METADATA: Readonly<
	Record<
		string,
		{ scope: SourceScope; authority: SourceAuthority; impactAreas: string[] }
	>
> = {
	"src-openai-blog": {
		scope: "global",
		authority: "official",
		impactAreas: ["ai", "ml", "llm", "agents"],
	},
	"src-huggingface": {
		scope: "global",
		authority: "official",
		impactAreas: ["ai", "ml", "llm", "open-source"],
	},
	"src-github-blog": {
		scope: "global",
		authority: "official",
		impactAreas: ["open-source", "devops", "ai"],
	},
	"src-martin-fowler": {
		scope: "global",
		authority: "personal",
		impactAreas: ["architecture", "backend", "testing"],
	},
	"src-web-dev": {
		scope: "global",
		authority: "official",
		impactAreas: ["web", "frontend", "performance"],
	},
	"src-cloudflare": {
		scope: "global",
		authority: "official",
		impactAreas: ["internet", "infrastructure", "networking", "security"],
	},
	"src-hashicorp": {
		scope: "global",
		authority: "official",
		impactAreas: ["devops", "infrastructure", "cloud"],
	},
	"src-aws": {
		scope: "global",
		authority: "official",
		impactAreas: ["cloud", "infrastructure", "compute"],
	},
	"src-krebs": {
		scope: "global",
		authority: "media",
		impactAreas: ["security", "privacy", "internet"],
	},
	"src-cloudflare-security": {
		scope: "global",
		authority: "official",
		impactAreas: ["security", "internet", "infrastructure"],
	},
	"src-openssf": {
		scope: "global",
		authority: "official",
		impactAreas: ["open-source", "security"],
	},
	"src-rust": {
		scope: "global",
		authority: "official",
		impactAreas: ["programming-languages", "rust"],
	},
	"src-python": {
		scope: "global",
		authority: "official",
		impactAreas: ["programming-languages", "python"],
	},
	"src-go-blog": {
		scope: "global",
		authority: "official",
		impactAreas: ["programming-languages", "go"],
	},
	"src-nodejs": {
		scope: "global",
		authority: "official",
		impactAreas: ["programming-languages", "javascript", "backend"],
	},
	"src-react": {
		scope: "global",
		authority: "official",
		impactAreas: ["web", "frontend", "javascript"],
	},
	"src-vercel": {
		scope: "global",
		authority: "official",
		impactAreas: ["web", "frontend", "cloud"],
	},
	"src-simon-willison": {
		scope: "global",
		authority: "personal",
		impactAreas: ["ai", "llm", "data", "open-source"],
	},
	"src-jvns": {
		scope: "global",
		authority: "personal",
		impactAreas: ["devops", "databases", "networking"],
	},
	"src-smashing": {
		scope: "global",
		authority: "media",
		impactAreas: ["web", "frontend", "design"],
	},
	"src-aws-security": {
		scope: "global",
		authority: "official",
		impactAreas: ["security", "cloud", "infrastructure"],
	},
	"src-ms-devblogs": {
		scope: "global",
		authority: "official",
		impactAreas: ["backend", "programming-languages", "cloud"],
	},
	"src-google-ai": {
		scope: "global",
		authority: "official",
		impactAreas: ["ai", "ml", "llm", "research"],
	},
	"src-netflix-tech": {
		scope: "global",
		authority: "official",
		impactAreas: ["backend", "architecture", "infrastructure", "performance"],
	},
};

/**
 * Insert default sources. `INSERT OR IGNORE` means subsequent runs leave
 * user modifications untouched — only truly new source IDs are added when
 * the seed list grows across versions. v1.8.0: sources also carry their
 * source list membership (list_id) and geography/language tags.
 */
export function seedSources(db: Database.Database): void {
	const insert = db.prepare(`
		INSERT OR IGNORE INTO sources (id, name, url, type, category, adapter, configuration, enabled, list_id, country, city, language, scope, authority, impact_areas)
		VALUES (@id, @name, @url, @type, @category, @adapter, @configuration, 1, @listId, @country, @city, @language, @scope, @authority, @impactAreas)
	`);
	// v1.8.1 — a deleted list stays deleted: skip its seed sources so a restart
	// never resurrects the source rows the delete removed (the list row itself
	// is protected by the `deleted` flag in seedSourceLists).
	const deletedListIds = new Set(
		(
			db
				.prepare("SELECT id FROM source_lists WHERE deleted = 1")
				.all() as Array<{ id: string }>
		).map((r) => r.id),
	);
	for (const s of SEED_SOURCES) {
		if (s.listId && deletedListIds.has(s.listId)) continue;
		const meta = SEED_SOURCE_METADATA[s.id];
		insert.run({
			...s,
			configuration: JSON.stringify(s.configuration),
			listId: s.listId ?? null,
			country: s.country ?? null,
			city: s.city ?? null,
			language: s.language ?? null,
			scope: meta?.scope ?? null,
			authority: meta?.authority ?? null,
			impactAreas: meta?.impactAreas ? JSON.stringify(meta.impactAreas) : null,
		});
	}
}

/**
 * Backfill geography/language tags onto seed rows that predate the columns
 * (v1.8.0). `INSERT OR IGNORE` never touches existing rows, so a DB migrated
 * from an older version keeps its 24 seeded sources with NULL tags — this
 * fills them in, but only where the row is still untagged (a user's own
 * country/city/language edit is never overwritten). Semantic metadata
 * (scope/authority/impact areas) is backfilled the same guarded way.
 */
export function backfillSeedTags(db: Database.Database): void {
	const update = db.prepare(`
		UPDATE sources
		SET country = ?, city = ?, language = ?
		WHERE id = ? AND country IS NULL AND language IS NULL
	`);
	let tagged = 0;
	for (const s of SEED_SOURCES) {
		const { changes } = update.run(
			s.country ?? null,
			s.city ?? null,
			s.language ?? null,
			s.id,
		);
		tagged += changes;
	}
	if (tagged > 0) {
		console.log(`• Tagged ${tagged} seed source(s) with country/city/language`);
	}

	// v1.8.0 — semantic metadata (scope/authority/impact areas). Guarded on
	// scope+authority being NULL so a user's own classification is never
	// overwritten; re-runs are no-ops.
	const updateMeta = db.prepare(`
		UPDATE sources
		SET scope = ?, authority = ?, impact_areas = ?
		WHERE id = ? AND scope IS NULL AND authority IS NULL
	`);
	let meta = 0;
	for (const s of SEED_SOURCES) {
		const m = SEED_SOURCE_METADATA[s.id];
		if (!m) continue;
		const { changes } = updateMeta.run(
			m.scope,
			m.authority,
			JSON.stringify(m.impactAreas),
			s.id,
		);
		meta += changes;
	}
	if (meta > 0) {
		console.log(
			`• Classified ${meta} seed source(s) with scope/authority/impact`,
		);
	}
}

/**
 * Seed-source feed URL repairs (v1.8.0 data fix).
 *
 * `INSERT OR IGNORE` never updates existing rows, so an install that already
 * has a seeded source with a since-moved feed keeps the dead URL forever. Each
 * repair only touches a row that still carries the exact dead URL — a user's
 * custom URL edit is never overwritten. The configuration is rewritten with a
 * fresh `{ feedUrl }` (all repaired sources are RSS seed rows whose config is
 * exactly that); a malformed legacy configuration can't crash startup this way.
 */
const SEED_URL_REPAIRS: ReadonlyArray<{
	id: string;
	deadUrl: string;
	workingUrl: string;
}> = [
	{
		id: "src-cloudflare-security",
		deadUrl: "https://blog.cloudflare.com/security/feed/",
		workingUrl: "https://blog.cloudflare.com/tag/security/rss/",
	},
	{
		id: "src-react",
		deadUrl: "https://react.dev/blog/rss.xml",
		workingUrl: "https://react.dev/feed.xml",
	},
	{
		id: "src-openssf",
		deadUrl: "https://openssf.org/blog/feed/",
		workingUrl: "https://openssf.org/feed/",
	},
];

export function repairSeedUrls(db: Database.Database): void {
	const update = db.prepare(`
		UPDATE sources
		SET url = ?, configuration = ?
		WHERE id = ? AND url = ?
	`);
	let repaired = 0;
	for (const { id, deadUrl, workingUrl } of SEED_URL_REPAIRS) {
		const { changes } = update.run(
			workingUrl,
			JSON.stringify({ feedUrl: workingUrl }),
			id,
			deadUrl,
		);
		repaired += changes;
	}
	if (repaired > 0) {
		console.log(`• Repaired ${repaired} seed source feed URL(s)`);
	}
}

/** One curated list definition to seed (v1.8.0 — official lists only). */
export interface SourceListSeed {
	id: string;
	name: string;
	description: string;
	origin: "official" | "community";
	nsfw: boolean;
	version: string | null;
}

/**
 * The official source lists. One for now: the Developer & Software Engineering
 * starter list (24 sources) — defined in sources/developer.json and bundled
 * into the app at build time (see developer-seed.generated.ts). `sources_json`
 * is derived from SEED_SOURCES so the cached catalog stays in sync.
 */
export const SEED_SOURCE_LISTS: SourceListSeed[] = [DEVELOPER_SEED_LIST];

/**
 * Seed the curated lists and backfill membership for pre-v1.8.0 databases.
 *
 * The list row is INSERT OR IGNORE (never overwrites user edits). The backfill
 * UPDATE only touches rows whose list_id is still NULL, so existing seed
 * sources created before v1.8.0 join the developer list exactly once; every
 * subsequent run is a no-op.
 */
export function seedSourceLists(db: Database.Database): void {
	// v1.8.1 — INSERT OR IGNORE leaves a deleted list's row untouched (it stays
	// `deleted = 1`), so an official list the user deleted stays gone across
	// restarts. seedSources skips its source rows the same way.
	const insert = db.prepare(`
		INSERT OR IGNORE INTO source_lists (id, name, description, origin, nsfw, enabled, version, sources_json, curator)
		VALUES (?, ?, ?, ?, ?, 1, ?, ?, NULL)
	`);
	for (const list of SEED_SOURCE_LISTS) {
		const defs = SEED_SOURCES.filter((s) => s.listId === list.id).map(
			toSourceListDef,
		);
		insert.run(
			list.id,
			list.name,
			list.description,
			list.origin,
			list.nsfw ? 1 : 0,
			list.version,
			JSON.stringify(defs),
		);
	}

	// Backfill membership for seed sources that predate v1.8.0.
	const backfill = db.prepare(
		"UPDATE sources SET list_id = ? WHERE id = ? AND list_id IS NULL",
	);
	for (const s of SEED_SOURCES) {
		if (s.listId) backfill.run(s.listId, s.id);
	}
}

function toSourceListDef(s: SeedSource): SourceListSourceDefinition {
	const meta = SEED_SOURCE_METADATA[s.id];
	return {
		id: s.id,
		name: s.name,
		url: s.url,
		type: s.type as SourceListSourceDefinition["type"],
		category: s.category as SourceListSourceDefinition["category"],
		adapter: s.adapter,
		configuration:
			s.configuration as SourceListSourceDefinition["configuration"],
		country: s.country,
		city: s.city,
		language: s.language,
		scope: meta?.scope ?? null,
		authority: meta?.authority ?? null,
		impactAreas: meta?.impactAreas ?? null,
	};
}

/**
 * Idempotent archive-spine backfill (v1.6.0).
 *
 * Every origin row (article, search history, brief history, generated history)
 * must have exactly one spine row in `content_items` (R-A09). New rows are
 * created by their owning services in the same transaction; this pass repairs
 * any gap — including all pre-1.6.0 rows — and runs on every startup so the
 * invariant self-heals. Only rows with a NULL content_item_id are touched, so
 * re-runs are safe. Returns the number of spines created.
 */
export function ensureSpines(db: Database.Database): number {
	const insertSpine = db.prepare(
		`INSERT INTO content_items (id, content_type, created_at, updated_at)
		 VALUES (?, ?, ?, ?)`,
	);
	const attachArticle = db.prepare(
		"UPDATE articles SET content_item_id = ? WHERE id = ?",
	);
	const attachSearch = db.prepare(
		"UPDATE search_history SET content_item_id = ? WHERE id = ?",
	);
	const attachBrief = db.prepare(
		"UPDATE brief_history SET content_item_id = ? WHERE id = ?",
	);
	const attachGenerated = db.prepare(
		"UPDATE generated_history SET content_item_id = ? WHERE id = ?",
	);

	const run = db.transaction(() => {
		let count = 0;

		const articles = db
			.prepare(
				"SELECT id, collected_at FROM articles WHERE content_item_id IS NULL",
			)
			.all() as Array<{ id: string; collected_at: number | null }>;
		for (const a of articles) {
			const id = randomUUID();
			const at = a.collected_at ?? Date.now();
			insertSpine.run(id, "article", at, at);
			attachArticle.run(id, a.id);
			count += 1;
		}

		const searches = db
			.prepare(
				"SELECT id, mode, created_at FROM search_history WHERE content_item_id IS NULL",
			)
			.all() as Array<{ id: string; mode: string; created_at: number | null }>;
		for (const s of searches) {
			const id = randomUUID();
			const at = s.created_at ?? Date.now();
			insertSpine.run(
				id,
				s.mode === "ai" ? "ai-ask" : "keyword-search",
				at,
				at,
			);
			attachSearch.run(id, s.id);
			count += 1;
		}

		const briefs = db
			.prepare(
				"SELECT id, created_at FROM brief_history WHERE content_item_id IS NULL",
			)
			.all() as Array<{ id: string; created_at: number | null }>;
		for (const b of briefs) {
			const id = randomUUID();
			const at = b.created_at ?? Date.now();
			insertSpine.run(id, "summary", at, at);
			attachBrief.run(id, b.id);
			count += 1;
		}

		const generated = db
			.prepare(
				"SELECT id, created_at FROM generated_history WHERE content_item_id IS NULL",
			)
			.all() as Array<{ id: string; created_at: number | null }>;
		for (const g of generated) {
			const id = randomUUID();
			const at = g.created_at ?? Date.now();
			insertSpine.run(id, "summary", at, at);
			attachGenerated.run(id, g.id);
			count += 1;
		}

		return count;
	});

	return run();
}

/**
 * v1.6.0 — same-kind sibling name uniqueness on `collections` (R-A11).
 *
 * `ArchiveService` is the primary gate (409 on a same-kind duplicate name
 * under the same parent; a folder and a category with the same name coexist).
 * These partial unique indexes are the race backstop. They are created only
 * when no legacy duplicates exist — a dirty DB keeps running (the service
 * check still enforces going forward) instead of crashing startup on a
 * failing CREATE UNIQUE INDEX. `COLLATE NOCASE` mirrors the service's
 * case-insensitive comparison.
 */
export function ensureCollectionNameIndex(db: Database.Database): void {
	// v1.7.0 — the partial unique indexes now exclude soft-deleted (trashed)
	// collections, so a same-name collection can be created/restored while the
	// old one sits in the trash (the service check filters deleted rows too).
	// Indexes are rebuildable derived structures (R-A09), so DROP + CREATE is
	// safe and idempotent; still skipped entirely on dirty legacy DBs.
	const legacyDuplicates = db
		.prepare(
			`SELECT parent_id, kind, name COLLATE NOCASE AS n
			 FROM collections
			 GROUP BY parent_id, kind, n
			 HAVING COUNT(*) > 1`,
		)
		.all();
	if (legacyDuplicates.length > 0) return;

	db.exec(`
		DROP INDEX IF EXISTS idx_collections_parent_kind_name;
		DROP INDEX IF EXISTS idx_collections_root_kind_name;
		CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_parent_kind_name
			ON collections(parent_id, kind, name COLLATE NOCASE)
			WHERE parent_id IS NOT NULL AND deleted_at IS NULL;
		CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_root_kind_name
			ON collections(kind, name COLLATE NOCASE)
			WHERE parent_id IS NULL AND deleted_at IS NULL;
	`);
}

/**
 * Idempotent migration: creates tables, sets up FTS5, applies additive ALTERs,
 * seeds defaults, and links archive spines. Called both on server startup and
 * from the CLI (pnpm db:migrate).
 */
export function runMigrations(db: Database.Database): void {
	db.exec(DDL);

	// Additive column adds — tolerated if the column already exists.
	for (const stmt of ADDITIVE_DDLS) {
		try {
			db.exec(stmt);
		} catch (err) {
			const msg = (err as Error).message.toLowerCase();
			if (!msg.includes("duplicate column")) {
				throw err;
			}
		}
	}

	// ── FTS5 (v1.3.0, author column v1.6.0, original_title column v1.8.0) ──
	// Runs AFTER the additive ALTERs: the backfill SELECTs `original_title`,
	// which is an ADDITIVE_DDLS column (v1.7.0) — a fresh DB lacks it until
	// the ALTERs above have run.
	db.function("normalize_fts", (text: unknown) => {
		if (typeof text !== "string" || text.length === 0) return "";
		return normalizeText(text);
	});
	const backfilled = ensureFtsSchema(db);
	if (backfilled > 0) {
		console.log(`• Backfilled ${backfilled} articles into FTS index`);
	}
	// ── end FTS5 ───────────────────────────────────────────────────────

	// Archive spine backfill — links every origin row to a content item.
	const repaired = ensureSpines(db);
	if (repaired > 0) {
		console.log(`• Linked ${repaired} archive spine rows (content_items)`);
	}

	// Archive spine sweep — the inverse invariant: drop spines no origin row
	// claims (left behind by retention pruning / pre-fix deletes). Runs on every
	// startup so a ghost "Untitled" Archive item never persists (R-A09).
	const swept = sweepOrphanSpines(db);
	if (swept > 0) {
		console.log(`• Swept ${swept} orphaned archive spine rows (content_items)`);
	}

	// Collection sibling-name uniqueness backstop (skipped on dirty legacy DBs).
	ensureCollectionNameIndex(db);

	seedDefaults(db);
}
