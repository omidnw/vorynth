import type {
	BriefHistoryEntry,
	BriefPeriod,
	SearchHistoryEntry,
	SearchMode,
} from "@vorynth/types";

/**
 * Resolve a history entry id from a list.
 *
 * The job-result contract carries only the raw {@link PeriodSummary} /
 * {@link AskResult} — never the history row id (the engine generates the id
 * server-side when it records the row, then discards it). The history list
 * endpoints, however, return rows already sorted by `createdAt desc`, so the
 * first row matching the natural key (period / query+mode) is the one a job
 * that just finished has produced.
 *
 * These pure helpers do that lookup. They take a list (e.g. from
 * `fetchBriefHistory()` / `fetchSearchHistory()`) and return the id, or null
 * when no match exists yet (e.g. the row hasn't been written, or the user has
 * disabled recording).
 */

/**
 * Find the newest brief-history entry whose `period` matches.
 *
 * Used by `<PeriodSummaryPanel>` to wire its "View full brief" button to the
 * dedicated detail page right after a summarize job finishes.
 */
export function findBriefEntryId(
	items: BriefHistoryEntry[],
	period: BriefPeriod,
): string | null {
	const match = items.find((e) => e.period === period);
	return match?.id ?? null;
}

/**
 * Find the newest search-history entry whose query + mode match.
 *
 * Query matching is case-insensitive and trims whitespace so minor edits don't
 * break the lookup. Used by `<SearchPage>` to wire both the Ask-AI answer and
 * the keyword results list to their dedicated detail page.
 */
export function findSearchEntryId(
	items: SearchHistoryEntry[],
	query: string,
	mode: SearchMode,
): string | null {
	const normalized = query.trim().toLowerCase();
	const match = items.find(
		(e) => e.mode === mode && e.query.trim().toLowerCase() === normalized,
	);
	return match?.id ?? null;
}
