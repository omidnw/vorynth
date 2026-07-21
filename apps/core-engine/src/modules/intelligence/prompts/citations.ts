import type { Citation } from "@vorynth/types";

/**
 * Citation utilities shared by the period summary and AI search.
 *
 * The model is asked to write `[N]` markers that refer to articles by their
 * 1-based position in the prompt context. These helpers resolve those markers
 * to real `Citation` objects the frontend can render as hoverable chips.
 *
 * Both single `[N]` and comma-separated multi-cite groups like `[1,3,5]` or
 * `[1, 3]` are supported. The prompt instructs the model to emit comma-form;
 * concatenated `[1][3]` also still works because each bracket is matched.
 */

/** Regex matching `[1]`, `[12]`, `[1,3]`, `[1, 3, 5]`, etc. anywhere in text. */
const CITE_RE = /\[(\d[\d\s,]*)\]/g;

/**
 * Parse a single bracket group (e.g. `"1, 3, 5"`) into a clean list of Ns,
 * dropping anything that isn't a positive integer.
 */
function parseGroup(inner: string): number[] {
	return inner
		.split(",")
		.map((s) => Number(s.trim()))
		.filter((n) => Number.isInteger(n) && n >= 1);
}

/**
 * Scan text for `[N]` / `[N,M,...]` markers and return the set of distinct Ns
 * in order of first appearance. Used to know which context articles were
 * actually cited.
 */
export function extractCitedNumbers(...texts: string[]): number[] {
	const seen = new Set<number>();
	const ordered: number[] = [];
	for (const t of texts) {
		for (const m of t.matchAll(CITE_RE)) {
			const inner = m[1];
			if (!inner) continue;
			for (const n of parseGroup(inner)) {
				if (!seen.has(n)) {
					seen.add(n);
					ordered.push(n);
				}
			}
		}
	}
	return ordered;
}

/**
 * Resolve cited `[N]` markers to Citation objects using a position → article
 * map (the same articles we packed into the prompt, in the same order).
 *
 * Returns citations for every n that maps to a real article. If the model
 * invented numbers, they're silently dropped.
 */
export function resolveCitations(
	numbers: number[],
	context: Array<{
		articleId: string;
		title: string;
		sourceName: string;
		url: string;
		publishedAt: string | null;
	}>,
): Citation[] {
	const out: Citation[] = [];
	const used = new Set<number>();
	for (const n of numbers) {
		if (used.has(n)) continue; // dedupe by N
		const article = context[n - 1];
		if (!article) continue;
		used.add(n);
		out.push({ n, ...article });
	}
	return out;
}

/**
 * Strip a trailing `CITED: ...` line the model is asked to emit (used as a
 * fallback signal when `[N]` markers are absent).
 */
export function stripCitedLine(text: string): string {
	return text.replace(/\n*CITED:.*$/s, "").trim();
}
