import { apiFetch } from "@/lib/api/config";
import type { AskResult, SearchResult } from "@vorynth/types";

// Re-exported so existing importers (`import { AskResult } from "../search-api"`)
// keep working now that the type lives in the shared types package.
export type { AskResult };

/** Keyword search (no LLM). */
export async function searchKeyword(
	q: string,
	opts: { limit?: number; periodDays?: number } = {},
): Promise<SearchResult> {
	const params = new URLSearchParams({ q });
	if (opts.limit) params.set("limit", String(opts.limit));
	if (opts.periodDays) params.set("periodDays", String(opts.periodDays));
	return apiFetch<SearchResult>(`/search?${params}`);
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
