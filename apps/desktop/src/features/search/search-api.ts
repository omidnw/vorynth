import { apiFetch } from "@/lib/api/config";
import type {
	AdvancedSearchQuery,
	AskResult,
	SearchResult,
} from "@vorynth/types";

// Re-exported so existing importers (`import { AskResult } from "../search-api"`)
// keep working now that the type lives in the shared types package.
export type { AskResult };

/** Keyword search (no LLM), optional author filter (v1.6.0). */
export async function searchKeyword(
	q: string,
	opts: { limit?: number; periodDays?: number; author?: string } = {},
): Promise<SearchResult> {
	const params = new URLSearchParams({ q });
	if (opts.limit) params.set("limit", String(opts.limit));
	if (opts.periodDays) params.set("periodDays", String(opts.periodDays));
	if (opts.author) params.set("author", opts.author);
	return apiFetch<SearchResult>(`/search?${params}`);
}

/** Structured researcher search (v1.6.0) — filters over the collected corpus. */
export async function advancedSearch(
	query: AdvancedSearchQuery,
): Promise<SearchResult> {
	const params = new URLSearchParams();
	if (query.q) params.set("q", query.q);
	if (query.domains?.length) params.set("domains", query.domains.join(","));
	if (query.importance?.length)
		params.set("importance", query.importance.join(","));
	if (query.from) params.set("from", query.from);
	if (query.to) params.set("to", query.to);
	if (query.authors?.length) params.set("authors", query.authors.join(","));
	if (query.sources?.length) params.set("sources", query.sources.join(","));
	if (query.hasInsight) params.set("hasInsight", "true");
	if (query.limit) params.set("limit", String(query.limit));
	return apiFetch<SearchResult>(`/search/advanced?${params}`);
}

/** AI-assisted search (RAG, rate-limited). */
export async function searchAsk(
	q: string,
	opts: { periodDays?: number; budget?: number } = {},
): Promise<AskResult> {
	const params = new URLSearchParams({ q });
	if (opts.periodDays) params.set("periodDays", String(opts.periodDays));
	if (opts.budget) params.set("budget", String(opts.budget));
	return apiFetch<AskResult>(`/search/ask?${params}`, {
		method: "POST",
		body: JSON.stringify({}),
	});
}
