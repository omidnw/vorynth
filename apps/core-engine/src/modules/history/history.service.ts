import { Inject, Injectable, Logger } from "@nestjs/common";
import { desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../db/database.service.js";
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
			this.db.db
				.insert(searchHistory)
				.values({
					id,
					query: input.query,
					mode: input.mode,
					result: input.result as unknown,
					title: input.query,
					archived: false,
					tokensUsed,
					hitCount,
					createdAt: now,
					updatedAt: now,
				})
				.run();
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
		const where = includeArchived
			? undefined
			: eq(searchHistory.archived, false);
		const rows = where
			? this.db.db
					.select()
					.from(searchHistory)
					.where(where)
					.orderBy(desc(searchHistory.createdAt))
					.all()
			: this.db.db
					.select()
					.from(searchHistory)
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

	deleteSearch(ids: string[]): number {
		if (ids.length === 0) return 0;
		const res = this.db.db
			.delete(searchHistory)
			.where(inArray(searchHistory.id, ids))
			.run();
		return res.changes;
	}

	clearSearch(): number {
		const res = this.db.db.delete(searchHistory).run();
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
			this.db.db
				.insert(briefHistory)
				.values({
					id,
					period: input.period,
					periodStart: input.periodStart,
					periodEnd: input.periodEnd,
					result: input.result as unknown,
					title: this.defaultBriefTitle(input.period, input.result),
					archived: false,
					storyCount: input.result.storyCount,
					createdAt: now,
					updatedAt: now,
				})
				.run();
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
		const where = includeArchived
			? undefined
			: eq(briefHistory.archived, false);
		const rows = where
			? this.db.db
					.select()
					.from(briefHistory)
					.where(where)
					.orderBy(desc(briefHistory.createdAt))
					.all()
			: this.db.db
					.select()
					.from(briefHistory)
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
			.delete(briefHistory)
			.where(inArray(briefHistory.id, ids))
			.run();
		return res.changes;
	}

	clearBrief(): number {
		const res = this.db.db.delete(briefHistory).run();
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
			this.db.db
				.insert(generatedHistory)
				.values({
					id,
					kind: input.kind,
					title: input.title.slice(0, 200),
					result: input.result,
					tokensUsed: input.tokensUsed,
					archived: false,
					createdAt: now,
					updatedAt: now,
				})
				.run();
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
		const where = includeArchived
			? undefined
			: eq(generatedHistory.archived, false);
		const rows = where
			? this.db.db
					.select()
					.from(generatedHistory)
					.where(where)
					.orderBy(desc(generatedHistory.createdAt))
					.all()
			: this.db.db
					.select()
					.from(generatedHistory)
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
			.delete(generatedHistory)
			.where(inArray(generatedHistory.id, ids))
			.run();
		return res.changes;
	}

	clearGenerated(): number {
		const res = this.db.db.delete(generatedHistory).run();
		return res.changes;
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
