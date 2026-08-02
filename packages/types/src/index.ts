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
	"rss" | "api" | "html" | "sitemap" | "github" | "reddit" | "arxiv";

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

/** HTML-crawl selector config (project-details.md §30). */
export interface HtmlSelectorConfig {
	titleSelector?: string;
	contentSelector?: string;
	dateSelector?: string;
	authorSelector?: string;
}

/** Opaque, engine-defined per adapter (e.g. RSS feed URL, HTML selectors). */
export type SourceConfiguration = Record<string, unknown> & {
	/** Present when {@link SourceType} is "html". */
	selectors?: HtmlSelectorConfig;
};

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

/** One row of the Media management dashboard (`GET /media/local`). */
export interface LocalMediaArticle {
	articleId: string;
	articleTitle: string;
	sourceName: string | null;
	/** ISO date the article was collected. */
	collectedAt: string;
	/** Number of media items kept locally for this article. */
	itemCount: number;
	/** Total bytes on disk for this article. */
	bytes: number;
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
export const VORYNTH_VERSION = "1.6.0";

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

export type JobKind = "collect" | "generate" | "summarize" | "regenerate";
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
		};

// ──────────────────────────────────────────────────────────────────────────
// Archive (v1.6.0) — unified user-owned intelligence space
// ──────────────────────────────────────────────────────────────────────────
// The Archive is Vorynth's user-owned organization layer: collected stories,
// bookmarked items, generated summaries, keyword searches, and Ask-AI answers
// are all `content_items` (metadata-only spines) whose real data lives in the
// origin tables (R-A09). Bookmarks are a flag on a content item, not a type
// (R-A10).

export type ContentItemType =
	| "article"
	| "summary"
	| "keyword-search"
	| "ai-ask";

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
