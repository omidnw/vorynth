import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Vorynth database schema (project-details.md §21).
 *
 * Implemented on SQLite via Drizzle. The DB is the app's local memory layer
 * (§19): sources → articles → clusters → insights → reports → user history.
 * All rows live on the user's device.
 */

// ── Sources ────────────────────────────────────────────────────────────────

export const sources = sqliteTable("sources", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	url: text("url").notNull(),
	type: text("type", {
		enum: ["rss", "api", "html", "sitemap", "github", "reddit", "arxiv"],
	})
		.notNull()
		.default("rss"),
	category: text("category", {
		enum: [
			"ai",
			"software-engineering",
			"programming-languages",
			"web-development",
			"backend",
			"devops",
			"cloud",
			"security",
			"open-source",
			"other",
		],
	})
		.notNull()
		.default("other"),
	adapter: text("adapter").notNull().default("rss"),
	/** Opaque per-adapter JSON: feed URL, HTML selectors, etc. */
	configuration: text("configuration", { mode: "json" })
		.$type<Record<string, unknown>>()
		.notNull()
		.default(sql`'{}'`),
	enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
	/**
	 * Per-source fetch window in days. The crawler only keeps articles newer
	 * than this. Default 30 — the user can override per source in Settings.
	 * Set to 0 (or null) to mean "unlimited".
	 */
	fetchWindowDays: integer("fetch_window_days").notNull().default(7),
	lastCheckedAt: integer("last_checked_at", { mode: "timestamp_ms" }),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// ── Articles ───────────────────────────────────────────────────────────────

export const articles = sqliteTable("articles", {
	id: text("id").primaryKey(),
	sourceId: text("source_id")
		.notNull()
		.references(() => sources.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	content: text("content").notNull().default(""),
	url: text("url").notNull(),
	author: text("author"),
	publishedAt: integer("published_at", { mode: "timestamp_ms" }),
	collectedAt: integer("collected_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	/** SHA-256(title + publishedAt + sourceId), unique per source. */
	hash: text("hash").notNull().unique(),
});

// ── Article Clusters ───────────────────────────────────────────────────────
// Groups similar articles into one intelligence event (§21).

export const articleClusters = sqliteTable("article_clusters", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	category: text("category").notNull().default("other"),
	/** Ordered list of article ids belonging to this cluster. */
	articleIds: text("article_ids", { mode: "json" })
		.$type<string[]>()
		.notNull()
		.default(sql`'[]'`),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// ── AI Insights ────────────────────────────────────────────────────────────
// AI-generated intelligence (summary, impact, recommended action, …).

export const aiInsights = sqliteTable("ai_insights", {
	id: text("id").primaryKey(),
	clusterId: text("cluster_id").references(() => articleClusters.id, {
		onDelete: "set null",
	}),
	articleId: text("article_id").references(() => articles.id, {
		onDelete: "set null",
	}),
	summary: text("summary").notNull(),
	significance: text("significance").notNull().default(""),
	impact: text("impact").notNull().default(""),
	importanceScore: real("importance_score").notNull().default(0),
	importanceTier: text("importance_tier", {
		enum: ["signal", "trend", "low-noise"],
	})
		.notNull()
		.default("low-noise"),
	category: text("category").notNull().default("other"),
	recommendedAction: text("recommended_action").notNull().default(""),
	generatedLanguage: text("generated_language").notNull().default("en"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// ── Reports ────────────────────────────────────────────────────────────────

export const reports = sqliteTable("reports", {
	id: text("id").primaryKey(),
	kind: text("kind", { enum: ["daily", "weekly", "monthly"] })
		.notNull()
		.default("daily"),
	/** Inclusive period covered (YYYY-MM-DD). */
	periodStart: text("period_start").notNull(),
	periodEnd: text("period_end").notNull(),
	insightIds: text("insight_ids", { mode: "json" })
		.$type<string[]>()
		.notNull()
		.default(sql`'[]'`),
	language: text("language").notNull().default("en"),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// ── User Profile ───────────────────────────────────────────────────────────
// Single-row table (id = "default").

export const userProfile = sqliteTable("user_profile", {
	id: text("id").primaryKey().default("default"),
	preferredUiLanguage: text("preferred_ui_language").notNull().default("en"),
	preferredIntelligenceLanguage: text("preferred_intelligence_language")
		.notNull()
		.default("en"),
	topics: text("topics", { mode: "json" })
		.$type<string[]>()
		.notNull()
		.default(sql`'[]'`),
	interests: text("interests", { mode: "json" })
		.$type<string[]>()
		.notNull()
		.default(sql`'[]'`),
	notificationSettings: text("notification_settings", { mode: "json" })
		.$type<Record<string, unknown>>()
		.notNull()
		.default(sql`'{}'`),
	aiPreferences: text("ai_preferences", { mode: "json" })
		.$type<Record<string, unknown>>()
		.notNull()
		.default(sql`'{}'`),
	// Display + personalization fields (added in v1.1.0 — additive ALTER TABLEs).
	firstName: text("first_name"),
	lastName: text("last_name"),
	alias: text("alias"),
	customInstruction: text("custom_instruction").notNull().default(""),
	behaviorSummary: text("behavior_summary").notNull().default(""),
	summaryGeneratedAt: integer("summary_generated_at", {
		mode: "timestamp_ms",
	}),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// ── LLM Providers (config + encrypted-at-rest credentials) ─────────────────

export const llmProviders = sqliteTable("llm_providers", {
	id: text("id").primaryKey(),
	kind: text("kind", {
		enum: ["gemini", "openai", "anthropic", "ollama"],
	}).notNull(),
	label: text("label").notNull(),
	/** Encrypted blob (AES-256-GCM). Opaque to the frontend. */
	encryptedApiKey: text("encrypted_api_key"),
	defaultModel: text("default_model"),
	baseUrl: text("base_url"),
	enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// ── Plugins (project-details.md §27) ───────────────────────────────────────

export const plugins = sqliteTable("plugins", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	type: text("type").notNull(),
	configuration: text("configuration", { mode: "json" })
		.$type<Record<string, unknown>>()
		.notNull()
		.default(sql`'{}'`),
	enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// ── LLM usage events (tokens + requests, for the Settings usage panel) ──────

export const usageEvents = sqliteTable("usage_events", {
	id: text("id").primaryKey(),
	/** "analyze" | "summarize" | "search" | "verify" */
	operation: text("operation").notNull(),
	providerKind: text("provider_kind").notNull(),
	model: text("model"),
	promptTokens: integer("prompt_tokens").notNull().default(0),
	completionTokens: integer("completion_tokens").notNull().default(0),
	totalTokens: integer("total_tokens").notNull().default(0),
	durationMs: integer("duration_ms").notNull().default(0),
	ok: integer("ok", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// ── Search history (keyword + Ask AI) ───────────────────────────────────────
// Persisted queries so the user can revisit, rename, archive, or delete them
// from the History drawer. The full result payload is cached as JSON so a past
// Ask-AI answer (which cost tokens) is viewable without re-running the LLM.

export const searchHistory = sqliteTable("search_history", {
	id: text("id").primaryKey(),
	query: text("query").notNull(),
	/** "keyword" | "ai" */
	mode: text("mode", { enum: ["keyword", "ai"] }).notNull(),
	/** Cached SearchResult (keyword) or AskResult (ai), serialized as JSON. */
	result: text("result", { mode: "json" }).$type<unknown>().notNull(),
	/** User-editable label. Defaults to the query text on insert. */
	title: text("title").notNull(),
	archived: integer("archived", { mode: "boolean" }).notNull().default(false),
	tokensUsed: integer("tokens_used").notNull().default(0),
	/** Number of hits/sources — cheap summary for the list view. */
	hitCount: integer("hit_count").notNull().default(0),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// ── Brief history (persisted period summaries) ──────────────────────────────
// Every successful `summarizePeriod()` call records its PeriodSummary here so
// the user can revisit past briefings from the History drawer on /brief.

export const briefHistory = sqliteTable("brief_history", {
	id: text("id").primaryKey(),
	/** "today" | "week" | "month" | "all" */
	period: text("period", { enum: ["today", "week", "month", "all"] }).notNull(),
	periodStart: integer("period_start", { mode: "timestamp_ms" }),
	periodEnd: integer("period_end", { mode: "timestamp_ms" }),
	/** Cached PeriodSummary payload, serialized as JSON. */
	result: text("result", { mode: "json" }).$type<unknown>().notNull(),
	title: text("title").notNull(),
	archived: integer("archived", { mode: "boolean" }).notNull().default(false),
	storyCount: integer("story_count").notNull().default(0),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// ── App settings (key/value) ────────────────────────────────────────────────
// Extensible store for user preferences that must sync across views (e.g.
// whether keyword/AI searches are recorded into history). Seeded on migrate.

export const appSettings = sqliteTable("app_settings", {
	key: text("key").primaryKey(),
	/** Stored as a JSON-encoded value (string/number/boolean/object). */
	value: text("value", { mode: "json" }).$type<unknown>().notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// ── Article media (v1.1.0) ─────────────────────────────────────────────────
// Media (images/video) discovered for an article. By default a row marks a
// known source URL only — bytes stay remote (`local_path`/`bytes` NULL). When
// the user opts to "keep locally", the engine downloads the bytes to disk and
// fills `local_path` + `bytes` + `kept_at`. One row per (article, url).

export const articleMedia = sqliteTable("article_media", {
	id: text("id").primaryKey(),
	articleId: text("article_id")
		.notNull()
		.references(() => articles.id, { onDelete: "cascade" }),
	/** Canonical source URL — always the reference, even when kept locally. */
	url: text("url").notNull(),
	kind: text("kind", { enum: ["image", "video"] }).notNull(),
	/** Filesystem path under the media dir when kept locally; null otherwise. */
	localPath: text("local_path"),
	bytes: integer("bytes"),
	mime: text("mime"),
	caption: text("caption"),
	/** When the user opted to keep this locally; null until then. */
	keptAt: integer("kept_at", { mode: "timestamp_ms" }),
	fetchedAt: integer("fetched_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// ── Generated history (v1.1.0) ─────────────────────────────────────────────
// Profile LLM generations (behavior summary, custom-instruction improve) are
// recorded here so each is revisitable from the History drawer's "Generated"
// scope — matches the search/brief history pattern.

export const generatedHistory = sqliteTable("generated_history", {
	id: text("id").primaryKey(),
	kind: text("kind", {
		enum: ["behavior-summary", "instruction-improve"],
	}).notNull(),
	title: text("title").notNull(),
	/** The generated text the LLM produced. */
	result: text("result").notNull(),
	tokensUsed: integer("tokens_used").notNull().default(0),
	archived: integer("archived", { mode: "boolean" }).notNull().default(false),
	createdAt: integer("created_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
});

// ── Convenience type re-exports ────────────────────────────────────────────

export type SourceRow = typeof sources.$inferSelect;
export type ArticleRow = typeof articles.$inferSelect;
export type ArticleClusterRow = typeof articleClusters.$inferSelect;
export type AiInsightRow = typeof aiInsights.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;
export type UserProfileRow = typeof userProfile.$inferSelect;
export type LlmProviderRow = typeof llmProviders.$inferSelect;
export type PluginRow = typeof plugins.$inferSelect;
export type UsageEventRow = typeof usageEvents.$inferSelect;
export type SearchHistoryRow = typeof searchHistory.$inferSelect;
export type BriefHistoryRow = typeof briefHistory.$inferSelect;
export type AppSettingRow = typeof appSettings.$inferSelect;
export type ArticleMediaRow = typeof articleMedia.$inferSelect;
export type GeneratedHistoryRow = typeof generatedHistory.$inferSelect;
