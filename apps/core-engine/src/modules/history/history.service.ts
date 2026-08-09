import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../db/database.service.js";
import { attachSpine, createSpine } from "../../db/spine.js";
import {
	appSettings,
	briefHistory,
	generatedHistory,
	searchHistory,
	type BriefHistoryRow,
	type GeneratedHistoryRow,
	type SearchHistoryRow,
} from "../../db/schema.js";
import type {
	AppSettings,
	BriefHistoryEntry,
	BriefHistoryList,
	GeneratedHistoryEntry,
	GeneratedHistoryKind,
	GeneratedHistoryList,
	HistorySearchResult,
	HistoryType,
	PeriodSummary,
	SearchHistoryEntry,
	SearchHistoryList,
	SearchMode,
	SearchResult,
	UpdateHistoryEntryInput,
} from "@vorynth/types";

/**
 * Persistent history for the History drawer.
 *
 * Records two kinds of entries:
 *   • Search history — every keyword query and every Ask-AI answer (Ask-AI is
 *     recorded by default because it costs tokens; keyword recording is opt-in).
 *   • Brief history  — every successful `summarizePeriod()` call, so past
 *     briefings can be revisited without regenerating them.
 *
 * Also owns the extensible `app_settings` key/value store, used today for the
 * history-recording toggles surfaced in Settings.
 *
 * Both `SearchService` and `IntelligenceService` call into the `record*`
 * methods at the moment they produce a result; the recording is best-effort
 * (errors are logged, never thrown, so a history write can't fail a search).
 */
@Injectable()
export class HistoryService {
	private readonly logger = new Logger("History");

	constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

	// ── Settings ────────────────────────────────────────────────────────────

	/** Get every app setting as a typed object. */
	getSettings(): AppSettings {
		const rows = this.db.db.select().from(appSettings).all();
		const out = {} as Record<string, unknown>;
		for (const r of rows) out[r.key] = r.value;
		return out as AppSettings;
	}

	/** Read one setting, returning `fallback` if unset. */
	getSetting<T>(key: string, fallback: T): T {
		const row = this.db.db
			.select()
			.from(appSettings)
			.where(eq(appSettings.key, key))
			.get();
		if (!row) return fallback;
		return row.value as T;
	}

	/** Upsert one setting by key. */
	setSetting(key: string, value: unknown): void {
		const now = new Date();
		this.db.db
			.insert(appSettings)
			.values({ key, value, updatedAt: now })
			.onConflictDoUpdate({
				target: appSettings.key,
				set: { value, updatedAt: now },
			})
			.run();
	}

	/** Convenience: should Ask-AI queries be recorded? */
	shouldRecordAi(): boolean {
		return this.getSetting<boolean>("history.search.recordAi", true);
	}

	/** Convenience: should keyword queries be recorded? */
	shouldRecordKeyword(): boolean {
		return this.getSetting<boolean>("history.search.recordKeyword", false);
	}

	// ── Search history ──────────────────────────────────────────────────────

	/** Record one search (keyword or AI) + its cached result. */
	recordSearch(input: {
		query: string;
		mode: SearchMode;
		result:
			| SearchResult
			| {
					answer: string;
					citations: unknown[];
					hits: unknown[];
					tokensUsed: number;
			  };
	}): SearchHistoryEntry | null {
		try {
			const id = randomUUID();
			const now = new Date();
			const tokensUsed =
				"tokensUsed" in input.result
					? (input.result as { tokensUsed: number }).tokensUsed
					: 0;
			const hitCount =
				"hits" in input.result
					? (input.result as { hits: unknown[] }).hits.length
					: 0;
			// History row + archive spine, one transaction (R-A09). Raw SQL —
			// and note `db.transaction(fn)` must be invoked (`})()`).
			this.db.rawDb.transaction(() => {
				this.db.rawDb
					.prepare(
						`INSERT INTO search_history
						   (id, query, mode, result, title, archived, tokens_used, hit_count, created_at, updated_at)
						 VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
					)
					.run(
						id,
						input.query,
						input.mode,
						JSON.stringify(input.result),
						input.query,
						tokensUsed,
						hitCount,
						now.getTime(),
						now.getTime(),
					);
				const spineId = createSpine(
					this.db.rawDb,
					input.mode === "ai" ? "ai-ask" : "keyword-search",
					now,
				);
				attachSpine(this.db.rawDb, "search_history", id, spineId);
			})();
			return this.toSearchEntry(
				this.db.db
					.select()
					.from(searchHistory)
					.where(eq(searchHistory.id, id))
					.get()!,
			);
		} catch (err) {
			this.logger.warn(`recordSearch failed: ${(err as Error).message}`);
			return null;
		}
	}

	listSearch(includeArchived = false): SearchHistoryList {
		// v1.7.0 — trashed (soft-deleted) entries never appear in the live list.
		const where = and(
			isNull(searchHistory.deletedAt),
			includeArchived ? undefined : eq(searchHistory.archived, false),
		);
		const rows = this.db.db
			.select()
			.from(searchHistory)
			.where(where)
			.orderBy(desc(searchHistory.createdAt))
			.all();
		return { items: rows.map((r) => this.toSearchEntry(r)) };
	}

	getSearch(id: string): SearchHistoryEntry | null {
		const row = this.db.db
			.select()
			.from(searchHistory)
			.where(eq(searchHistory.id, id))
			.get();
		return row ? this.toSearchEntry(row) : null;
	}

	updateSearch(
		id: string,
		patch: UpdateHistoryEntryInput,
	): SearchHistoryEntry | null {
		const set: Record<string, unknown> = { updatedAt: new Date() };
		if (patch.title !== undefined) set.title = patch.title;
		if (patch.archived !== undefined) set.archived = patch.archived;
		this.db.db
			.update(searchHistory)
			.set(set)
			.where(eq(searchHistory.id, id))
			.run();
		const row = this.db.db
			.select()
			.from(searchHistory)
			.where(eq(searchHistory.id, id))
			.get();
		return row ? this.toSearchEntry(row) : null;
	}

	// v1.7.0 — deletion is soft (goes to Trash, restorable); the linked spine is
	// untouched so no orphan appears while trashed. Permanent delete (purge*)
	// removes origin + spine (+ bookmark) in one transaction.

	deleteSearch(ids: string[]): number {
		if (ids.length === 0) return 0;
		const res = this.db.db
			.update(searchHistory)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(inArray(searchHistory.id, ids))
			.run();
		return res.changes;
	}

	restoreSearch(id: string): void {
		this.db.db
			.update(searchHistory)
			.set({ deletedAt: null, updatedAt: new Date() })
			.where(eq(searchHistory.id, id))
			.run();
	}

	purgeSearch(ids: string[]): number {
		if (ids.length === 0) return 0;
		const raw = this.db.rawDb;
		return raw.transaction(() => {
			const placeholders = ids.map(() => "?").join(", ");
			const spines = raw
				.prepare(
					`SELECT content_item_id FROM search_history
					 WHERE id IN (${placeholders}) AND content_item_id IS NOT NULL`,
				)
				.all(...ids) as Array<{ content_item_id: string }>;
			const res = raw
				.prepare(`DELETE FROM search_history WHERE id IN (${placeholders})`)
				.run(...ids);
			for (const s of spines) {
				raw
					.prepare("DELETE FROM bookmarks WHERE content_item_id = ?")
					.run(s.content_item_id);
				raw
					.prepare("DELETE FROM content_items WHERE id = ?")
					.run(s.content_item_id);
			}
			return res.changes;
		})();
	}

	clearSearch(): number {
		const res = this.db.db
			.update(searchHistory)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.run();
		return res.changes;
	}

	// ── Brief history ───────────────────────────────────────────────────────

	/** Record one persisted period briefing. */
	recordBrief(input: {
		period: BriefHistoryRow["period"];
		periodStart: Date | null;
		periodEnd: Date | null;
		result: PeriodSummary;
	}): BriefHistoryEntry | null {
		try {
			const id = randomUUID();
			const now = new Date();
			// History row + archive spine (`summary`, immutable), one transaction.
			this.db.rawDb.transaction(() => {
				this.db.rawDb
					.prepare(
						`INSERT INTO brief_history
						   (id, period, period_start, period_end, result, title, archived, story_count, created_at, updated_at)
						 VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
					)
					.run(
						id,
						input.period,
						input.periodStart?.getTime() ?? null,
						input.periodEnd?.getTime() ?? null,
						JSON.stringify(input.result),
						this.defaultBriefTitle(input.period, input.result),
						input.result.storyCount,
						now.getTime(),
						now.getTime(),
					);
				const spineId = createSpine(this.db.rawDb, "summary", now);
				attachSpine(this.db.rawDb, "brief_history", id, spineId);
			})();
			return this.toBriefEntry(
				this.db.db
					.select()
					.from(briefHistory)
					.where(eq(briefHistory.id, id))
					.get()!,
			);
		} catch (err) {
			this.logger.warn(`recordBrief failed: ${(err as Error).message}`);
			return null;
		}
	}

	listBrief(includeArchived = false): BriefHistoryList {
		const where = and(
			isNull(briefHistory.deletedAt),
			includeArchived ? undefined : eq(briefHistory.archived, false),
		);
		const rows = this.db.db
			.select()
			.from(briefHistory)
			.where(where)
			.orderBy(desc(briefHistory.createdAt))
			.all();
		return { items: rows.map((r) => this.toBriefEntry(r)) };
	}

	getBrief(id: string): BriefHistoryEntry | null {
		const row = this.db.db
			.select()
			.from(briefHistory)
			.where(eq(briefHistory.id, id))
			.get();
		return row ? this.toBriefEntry(row) : null;
	}

	updateBrief(
		id: string,
		patch: UpdateHistoryEntryInput,
	): BriefHistoryEntry | null {
		const set: Record<string, unknown> = { updatedAt: new Date() };
		if (patch.title !== undefined) set.title = patch.title;
		if (patch.archived !== undefined) set.archived = patch.archived;
		this.db.db
			.update(briefHistory)
			.set(set)
			.where(eq(briefHistory.id, id))
			.run();
		const row = this.db.db
			.select()
			.from(briefHistory)
			.where(eq(briefHistory.id, id))
			.get();
		return row ? this.toBriefEntry(row) : null;
	}

	deleteBrief(ids: string[]): number {
		if (ids.length === 0) return 0;
		const res = this.db.db
			.update(briefHistory)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(inArray(briefHistory.id, ids))
			.run();
		return res.changes;
	}

	restoreBrief(id: string): void {
		this.db.db
			.update(briefHistory)
			.set({ deletedAt: null, updatedAt: new Date() })
			.where(eq(briefHistory.id, id))
			.run();
	}

	purgeBrief(ids: string[]): number {
		if (ids.length === 0) return 0;
		const raw = this.db.rawDb;
		return raw.transaction(() => {
			const placeholders = ids.map(() => "?").join(", ");
			const spines = raw
				.prepare(
					`SELECT content_item_id FROM brief_history
					 WHERE id IN (${placeholders}) AND content_item_id IS NOT NULL`,
				)
				.all(...ids) as Array<{ content_item_id: string }>;
			const res = raw
				.prepare(`DELETE FROM brief_history WHERE id IN (${placeholders})`)
				.run(...ids);
			for (const s of spines) {
				raw
					.prepare("DELETE FROM bookmarks WHERE content_item_id = ?")
					.run(s.content_item_id);
				raw
					.prepare("DELETE FROM content_items WHERE id = ?")
					.run(s.content_item_id);
			}
			return res.changes;
		})();
	}

	clearBrief(): number {
		const res = this.db.db
			.update(briefHistory)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.run();
		return res.changes;
	}

	// ── Generated history (Profile LLM generations) ──────────────────────────

	/** Record one LLM generation from the Profile page. */
	recordGenerated(input: {
		kind: GeneratedHistoryKind;
		title: string;
		result: string;
		tokensUsed: number;
	}): GeneratedHistoryEntry | null {
		try {
			const id = randomUUID();
			const now = new Date();
			// History row + archive spine (`summary`, immutable), one transaction.
			this.db.rawDb.transaction(() => {
				this.db.rawDb
					.prepare(
						`INSERT INTO generated_history
						   (id, kind, title, result, tokens_used, archived, created_at, updated_at)
						 VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
					)
					.run(
						id,
						input.kind,
						input.title.slice(0, 200),
						input.result,
						input.tokensUsed,
						now.getTime(),
						now.getTime(),
					);
				const spineId = createSpine(this.db.rawDb, "summary", now);
				attachSpine(this.db.rawDb, "generated_history", id, spineId);
			})();
			return this.toGeneratedEntry(
				this.db.db
					.select()
					.from(generatedHistory)
					.where(eq(generatedHistory.id, id))
					.get()!,
			);
		} catch (err) {
			this.logger.warn(`recordGenerated failed: ${(err as Error).message}`);
			return null;
		}
	}

	listGenerated(includeArchived = false): GeneratedHistoryList {
		const where = and(
			isNull(generatedHistory.deletedAt),
			includeArchived ? undefined : eq(generatedHistory.archived, false),
		);
		const rows = this.db.db
			.select()
			.from(generatedHistory)
			.where(where)
			.orderBy(desc(generatedHistory.createdAt))
			.all();
		return { items: rows.map((r) => this.toGeneratedEntry(r)) };
	}

	getGenerated(id: string): GeneratedHistoryEntry | null {
		const row = this.db.db
			.select()
			.from(generatedHistory)
			.where(eq(generatedHistory.id, id))
			.get();
		return row ? this.toGeneratedEntry(row) : null;
	}

	updateGenerated(
		id: string,
		patch: UpdateHistoryEntryInput,
	): GeneratedHistoryEntry | null {
		const set: Record<string, unknown> = { updatedAt: new Date() };
		if (patch.title !== undefined) set.title = patch.title;
		if (patch.archived !== undefined) set.archived = patch.archived;
		this.db.db
			.update(generatedHistory)
			.set(set)
			.where(eq(generatedHistory.id, id))
			.run();
		const row = this.db.db
			.select()
			.from(generatedHistory)
			.where(eq(generatedHistory.id, id))
			.get();
		return row ? this.toGeneratedEntry(row) : null;
	}

	deleteGenerated(ids: string[]): number {
		if (ids.length === 0) return 0;
		const res = this.db.db
			.update(generatedHistory)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(inArray(generatedHistory.id, ids))
			.run();
		return res.changes;
	}

	restoreGenerated(id: string): void {
		this.db.db
			.update(generatedHistory)
			.set({ deletedAt: null, updatedAt: new Date() })
			.where(eq(generatedHistory.id, id))
			.run();
	}

	purgeGenerated(ids: string[]): number {
		if (ids.length === 0) return 0;
		const raw = this.db.rawDb;
		return raw.transaction(() => {
			const placeholders = ids.map(() => "?").join(", ");
			const spines = raw
				.prepare(
					`SELECT content_item_id FROM generated_history
					 WHERE id IN (${placeholders}) AND content_item_id IS NOT NULL`,
				)
				.all(...ids) as Array<{ content_item_id: string }>;
			const res = raw
				.prepare(`DELETE FROM generated_history WHERE id IN (${placeholders})`)
				.run(...ids);
			for (const s of spines) {
				raw
					.prepare("DELETE FROM bookmarks WHERE content_item_id = ?")
					.run(s.content_item_id);
				raw
					.prepare("DELETE FROM content_items WHERE id = ?")
					.run(s.content_item_id);
			}
			return res.changes;
		})();
	}

	clearGenerated(): number {
		const res = this.db.db
			.update(generatedHistory)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.run();
		return res.changes;
	}

	// ── Unified history search ────────────────────────────────────────────────

	/**
	 * Search across search/brief/generated history by title/query text.
	 * `type` narrows to one family; each hit's `type` tells the frontend which
	 * existing full-detail page to open (`/history/<type>/<id>`).
	 */
	searchAll(
		q: string,
		type?: HistoryType,
		includeArchived = false,
	): HistorySearchResult {
		const needle = `%${q}%`;
		const items: HistorySearchResult["items"] = [];
		const limit = 50;

		if (!type || type === "search") {
			const rows = this.db.db
				.select()
				.from(searchHistory)
				.where(
					and(
						isNull(searchHistory.deletedAt),
						includeArchived ? undefined : eq(searchHistory.archived, false),
						or(
							like(searchHistory.title, needle),
							like(searchHistory.query, needle),
						),
					),
				)
				.orderBy(desc(searchHistory.createdAt))
				.limit(limit)
				.all();
			for (const r of rows) {
				items.push({
					id: r.id,
					type: "search",
					title: r.title,
					createdAt: r.createdAt.toISOString(),
					archived: r.archived,
					snippet: r.query.slice(0, 80),
				});
			}
		}

		if (!type || type === "brief") {
			const rows = this.db.db
				.select()
				.from(briefHistory)
				.where(
					and(
						isNull(briefHistory.deletedAt),
						includeArchived ? undefined : eq(briefHistory.archived, false),
						like(briefHistory.title, needle),
					),
				)
				.orderBy(desc(briefHistory.createdAt))
				.limit(limit)
				.all();
			for (const r of rows) {
				items.push({
					id: r.id,
					type: "brief",
					title: r.title,
					createdAt: r.createdAt.toISOString(),
					archived: r.archived,
					snippet: r.title.slice(0, 80),
				});
			}
		}

		if (!type || type === "generated") {
			const rows = this.db.db
				.select()
				.from(generatedHistory)
				.where(
					and(
						isNull(generatedHistory.deletedAt),
						includeArchived ? undefined : eq(generatedHistory.archived, false),
						like(generatedHistory.title, needle),
					),
				)
				.orderBy(desc(generatedHistory.createdAt))
				.limit(limit)
				.all();
			for (const r of rows) {
				items.push({
					id: r.id,
					type: "generated",
					title: r.title,
					createdAt: r.createdAt.toISOString(),
					archived: r.archived,
					snippet: r.title.slice(0, 80),
				});
			}
		}

		// Newest first across families.
		items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
		return { items };
	}

	// ── mappers ─────────────────────────────────────────────────────────────

	private toSearchEntry(row: SearchHistoryRow): SearchHistoryEntry {
		return {
			id: row.id,
			query: row.query,
			mode: row.mode,
			result: row.result as SearchResult,
			title: row.title,
			archived: row.archived,
			tokensUsed: row.tokensUsed,
			hitCount: row.hitCount,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		};
	}

	private toBriefEntry(row: BriefHistoryRow): BriefHistoryEntry {
		return {
			id: row.id,
			period: row.period,
			periodStart: row.periodStart ? row.periodStart.toISOString() : null,
			periodEnd: row.periodEnd ? row.periodEnd.toISOString() : null,
			result: row.result as PeriodSummary,
			title: row.title,
			archived: row.archived,
			storyCount: row.storyCount,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		};
	}

	private toGeneratedEntry(row: GeneratedHistoryRow): GeneratedHistoryEntry {
		return {
			id: row.id,
			kind: row.kind,
			title: row.title,
			result: row.result,
			tokensUsed: row.tokensUsed,
			archived: row.archived,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		};
	}

	private defaultBriefTitle(
		period: BriefHistoryRow["period"],
		summary: PeriodSummary,
	): string {
		const label =
			period === "today"
				? "Today"
				: period === "week"
					? "This Week"
					: period === "month"
						? "This Month"
						: "All Time";
		const headline = summary.headline?.trim().slice(0, 60);
		return headline
			? `${label} — ${headline}${summary.headline.length > 60 ? "…" : ""}`
			: label;
	}
}
