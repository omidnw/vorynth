import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { normalizeText } from "../search/text-normalizer.js";
import { ensureFtsSchema } from "./fts-sync.js";

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
  configuration TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  fetch_window_days INTEGER NOT NULL DEFAULT 7,
  last_checked_at INTEGER,
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
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX IF NOT EXISTS idx_generated_history_created_at ON generated_history(created_at);
CREATE INDEX IF NOT EXISTS idx_generated_history_archived ON generated_history(archived);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  parent_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'folder',
  llm_generated INTEGER NOT NULL DEFAULT 0,
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
	};
	const seedSetting = db.prepare(
		"INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)",
	);
	for (const [key, value] of Object.entries(defaultSettings)) {
		seedSetting.run(key, JSON.stringify(value));
	}

	// Seed 13 default sources so first-run users have real breadth.
	seedSources(db);
}

export interface SeedSource {
	id: string;
	name: string;
	url: string;
	type: string;
	category: string;
	adapter: string;
	configuration: { feedUrl: string };
}

export const SEED_SOURCES: SeedSource[] = [
	// Artificial Intelligence
	{
		id: "src-openai-blog",
		name: "OpenAI Blog",
		url: "https://openai.com/blog/rss.xml",
		type: "rss",
		category: "ai",
		adapter: "rss",
		configuration: { feedUrl: "https://openai.com/blog/rss.xml" },
	},
	{
		id: "src-huggingface",
		name: "Hugging Face Blog",
		url: "https://huggingface.co/blog/feed.xml",
		type: "rss",
		category: "ai",
		adapter: "rss",
		configuration: { feedUrl: "https://huggingface.co/blog/feed.xml" },
	},
	// Software Engineering
	{
		id: "src-github-blog",
		name: "The GitHub Blog",
		url: "https://github.blog/feed/",
		type: "rss",
		category: "software-engineering",
		adapter: "rss",
		configuration: { feedUrl: "https://github.blog/feed/" },
	},
	{
		id: "src-martin-fowler",
		name: "Martin Fowler",
		url: "https://martinfowler.com/feed.atom",
		type: "rss",
		category: "software-engineering",
		adapter: "rss",
		configuration: { feedUrl: "https://martinfowler.com/feed.atom" },
	},
	// Web Development
	{
		id: "src-web-dev",
		name: "web.dev",
		url: "https://web.dev/feed.xml",
		type: "rss",
		category: "web-development",
		adapter: "rss",
		configuration: { feedUrl: "https://web.dev/feed.xml" },
	},
	// Backend
	{
		id: "src-cloudflare",
		name: "Cloudflare Blog",
		url: "https://blog.cloudflare.com/rss/",
		type: "rss",
		category: "backend",
		adapter: "rss",
		configuration: { feedUrl: "https://blog.cloudflare.com/rss/" },
	},
	// DevOps
	{
		id: "src-hashicorp",
		name: "HashiCorp Blog",
		url: "https://www.hashicorp.com/blog/feed.xml",
		type: "rss",
		category: "devops",
		adapter: "rss",
		configuration: { feedUrl: "https://www.hashicorp.com/blog/feed.xml" },
	},
	// Cloud
	{
		id: "src-aws",
		name: "AWS News Blog",
		url: "https://aws.amazon.com/blogs/aws/feed/",
		type: "rss",
		category: "cloud",
		adapter: "rss",
		configuration: { feedUrl: "https://aws.amazon.com/blogs/aws/feed/" },
	},
	// Security
	{
		id: "src-krebs",
		name: "Krebs on Security",
		url: "https://krebsonsecurity.com/feed/",
		type: "rss",
		category: "security",
		adapter: "rss",
		configuration: { feedUrl: "https://krebsonsecurity.com/feed/" },
	},
	{
		id: "src-cloudflare-security",
		name: "Cloudflare Security",
		url: "https://blog.cloudflare.com/security/feed/",
		type: "rss",
		category: "security",
		adapter: "rss",
		configuration: { feedUrl: "https://blog.cloudflare.com/security/feed/" },
	},
	// Open Source
	{
		id: "src-openssf",
		name: "OpenSSF Blog",
		url: "https://openssf.org/blog/feed/",
		type: "rss",
		category: "open-source",
		adapter: "rss",
		configuration: { feedUrl: "https://openssf.org/blog/feed/" },
	},
	// Programming Languages
	{
		id: "src-rust",
		name: "Rust Blog",
		url: "https://blog.rust-lang.org/feed.xml",
		type: "rss",
		category: "programming-languages",
		adapter: "rss",
		configuration: { feedUrl: "https://blog.rust-lang.org/feed.xml" },
	},
	{
		id: "src-python",
		name: "Python Insider",
		url: "https://pythoninsider.blogspot.com/feeds/posts/default",
		type: "rss",
		category: "programming-languages",
		adapter: "rss",
		configuration: {
			feedUrl: "https://pythoninsider.blogspot.com/feeds/posts/default",
		},
	},
];

/** Insert default sources. `INSERT OR IGNORE` means subsequent runs leave
 * user modifications untouched — only truly new source IDs are added when
 * the seed list grows across versions. */
export function seedSources(db: Database.Database): void {
	const insert = db.prepare(`
		INSERT OR IGNORE INTO sources (id, name, url, type, category, adapter, configuration, enabled)
		VALUES (@id, @name, @url, @type, @category, @adapter, @configuration, 1)
	`);
	for (const s of SEED_SOURCES) {
		insert.run({ ...s, configuration: JSON.stringify(s.configuration) });
	}
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
	const existing = db
		.prepare(
			`SELECT COUNT(*) AS c FROM sqlite_master
			 WHERE type = 'index' AND name IN (
			   'idx_collections_parent_kind_name',
			   'idx_collections_root_kind_name'
			 )`,
		)
		.get() as { c: number };
	if (existing.c === 2) return;

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
		CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_parent_kind_name
			ON collections(parent_id, kind, name COLLATE NOCASE)
			WHERE parent_id IS NOT NULL;
		CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_root_kind_name
			ON collections(kind, name COLLATE NOCASE)
			WHERE parent_id IS NULL;
	`);
}

/**
 * Idempotent migration: creates tables, sets up FTS5, applies additive ALTERs,
 * seeds defaults, and links archive spines. Called both on server startup and
 * from the CLI (pnpm db:migrate).
 */
export function runMigrations(db: Database.Database): void {
	db.exec(DDL);

	// ── FTS5 (v1.3.0, author column v1.6.0) ─────────────────────────────
	db.function("normalize_fts", (text: unknown) => {
		if (typeof text !== "string" || text.length === 0) return "";
		return normalizeText(text);
	});
	const backfilled = ensureFtsSchema(db);
	if (backfilled > 0) {
		console.log(`• Backfilled ${backfilled} articles into FTS index`);
	}
	// ── end FTS5 ───────────────────────────────────────────────────────

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

	// Archive spine backfill — links every origin row to a content item.
	const repaired = ensureSpines(db);
	if (repaired > 0) {
		console.log(`• Linked ${repaired} archive spine rows (content_items)`);
	}

	// Collection sibling-name uniqueness backstop (skipped on dirty legacy DBs).
	ensureCollectionNameIndex(db);

	seedDefaults(db);
}
