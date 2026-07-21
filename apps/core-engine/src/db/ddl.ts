import type Database from "better-sqlite3";
import { normalizeText } from "../search/text-normalizer.js";
import { FTS_VIRTUAL_DDL, FTS_BACKFILL_SQL } from "./fts-schema.js";

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
 * Idempotent migration: creates tables, sets up FTS5, applies additive ALTERs,
 * and seeds defaults. Called both on server startup and from the CLI
 * (pnpm db:migrate).
 */
export function runMigrations(db: Database.Database): void {
	db.exec(DDL);

	// ── FTS5 (v1.3.0) ──────────────────────────────────────────────────
	db.function("normalize_fts", (text: unknown) => {
		if (typeof text !== "string" || text.length === 0) return "";
		return normalizeText(text);
	});
	db.exec(FTS_VIRTUAL_DDL);
	// Backfill existing articles into FTS index (idempotent).
	const { changes: backfilled } = db.prepare(FTS_BACKFILL_SQL).run();
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

	seedDefaults(db);
}
