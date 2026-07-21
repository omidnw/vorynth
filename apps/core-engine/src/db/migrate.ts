import Database from "better-sqlite3";
import { resolveDbPath } from "./paths.js";
import { normalizeText } from "../search/text-normalizer.js";
import { FTS_VIRTUAL_DDL, FTS_BACKFILL_SQL } from "./fts-schema.js";

/**
 * Programmatic migration entrypoint: `pnpm db:migrate`.
 *
 * For the vertical slice we apply the schema directly via better-sqlite3's
 * `exec()` on the full DDL derived from `schema.ts`. Drizzle Kit generates
 * proper versioned migrations in `drizzle/` (Phase 6 hardening), but for the
 * slice a single idempotent DDL pass is clearer and has no ordering surprises.
 *
 * Idempotency relies on `CREATE TABLE IF NOT EXISTS`.
 */
const DDL = `
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
 * Column adds for existing databases. `ALTER TABLE ADD COLUMN` errors are
 * swallowed because the column may already exist on a re-run. After adding,
 * we also normalize any rows still on the old default (30) down to the new
 * default (7), so existing sources pick up the change on next migrate.
 */
const ADDITIVE_DDLS = [
	"ALTER TABLE sources ADD COLUMN fetch_window_days INTEGER NOT NULL DEFAULT 7",
	"UPDATE sources SET fetch_window_days = 7 WHERE fetch_window_days = 30",
	// v1.1.0 — user profile personalization fields (additive; tolerated on re-run).
	"ALTER TABLE user_profile ADD COLUMN first_name TEXT",
	"ALTER TABLE user_profile ADD COLUMN last_name TEXT",
	"ALTER TABLE user_profile ADD COLUMN alias TEXT",
	"ALTER TABLE user_profile ADD COLUMN custom_instruction TEXT NOT NULL DEFAULT ''",
	"ALTER TABLE user_profile ADD COLUMN behavior_summary TEXT NOT NULL DEFAULT ''",
	"ALTER TABLE user_profile ADD COLUMN summary_generated_at INTEGER",
	// v1.1.0 — article_media.updated_at (additive; the table itself is new).
	"ALTER TABLE article_media ADD COLUMN updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)",
];

async function main() {
	const filePath = resolveDbPath();
	const db = new Database(filePath);
	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");

	console.log(`▶ Migrating database at ${filePath}`);
	db.exec(DDL);

	// ── FTS5 setup (v1.3.0) ──────────────────────────────────────────
	console.log("▶ Setting up FTS5 full-text search");

	// Register Persian-aware normalizer so FTS can use it.
	db.function("normalize_fts", (text: unknown) => {
		if (typeof text !== "string" || text.length === 0) return "";
		return normalizeText(text);
	});

	db.exec(FTS_VIRTUAL_DDL);

	// Backfill existing articles into the FTS index (idempotent).
	const { changes: backfilled } = db.prepare(FTS_BACKFILL_SQL).run();
	if (backfilled > 0) {
		console.log(`• Backfilled ${backfilled} articles into FTS index`);
	}
	// ── end FTS5 ─────────────────────────────────────────────────────

	// Additive column adds — tolerated if the column already exists.
	for (const stmt of ADDITIVE_DDLS) {
		try {
			db.exec(stmt);
		} catch (err) {
			// "duplicate column name" on re-run — safe to ignore.
			const msg = (err as Error).message.toLowerCase();
			if (!msg.includes("duplicate column")) {
				throw err;
			}
		}
	}

	// Seed the single-row user profile if absent.
	const exists = db
		.prepare("SELECT COUNT(*) as c FROM user_profile WHERE id = 'default'")
		.get() as { c: number };
	if (exists.c === 0) {
		db.prepare(
			`INSERT INTO user_profile (id, preferred_ui_language, preferred_intelligence_language)
       VALUES ('default', 'en', 'en')`,
		).run();
		console.log("• Seeded default user_profile");
	}

	// Seed default app settings (history recording + reader preferences).
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

	db.close();
	console.log("✓ Migrations complete");
}

main().catch((err) => {
	console.error("✗ Migration failed", err);
	process.exit(1);
});
