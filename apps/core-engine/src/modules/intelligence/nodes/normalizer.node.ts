import type { IntelligenceStateType } from "../state/intelligence-state.js";

/**
 * Normalizer + Dedup node.
 *
 * Strips whitespace, drops empty/garbage items, and collapses near-duplicate
 * titles within this run. (Cross-run dedup already happened at crawl time via
 * the article hash.) For the vertical slice we keep this cheap and deterministic.
 */
export async function normalizer(
	state: IntelligenceStateType,
): Promise<Partial<IntelligenceStateType>> {
	const seen = new Set<string>();
	const cleaned = [];

	for (const a of state.articles ?? []) {
		const title = (a.title ?? "").trim();
		if (!title) continue;
		const key = title.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		cleaned.push(a);
	}

	return { articles: cleaned };
}
