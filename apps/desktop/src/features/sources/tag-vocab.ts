import { SOURCE_IMPACT_AREAS } from "@vorynth/types";
// Build-time vocabulary from `@sparring/tech-catalog` (built into
// src/vocab/tech-catalog.json). A vocabulary provider, never the source of
// truth — tags stay free-form (R-A06).
import techCatalog from "../../vocab/tech-catalog.json";

/**
 * Tag/category suggestion vocabulary (v1.9.0).
 *
 * A combination, per the plan: `@sparring/tech-catalog` (built at build time
 * into `src/vocab/tech-catalog.json`) + the app's own category slugs + the
 * impact-area vocabulary + tags already used on existing sources. The catalog
 * is a "vocabulary provider", never the source of truth — tags stay free-form
 * (R-A06), and the app's own words always win over duplicates.
 */

/** Built-in category slugs (same set as the Add Source category list). */
export const APP_CATEGORY_SLUGS = [
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
];

/** Same slug rule as the engine's tag normalizer. */
export function toSlug(value: string): string {
	return String(value)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Build the full suggestion vocabulary. `extra` lets the page feed in tags
 * already used on existing sources (so the user's own words reappear first).
 */
export function buildTagVocabulary(extra: string[] = []): string[] {
	const set = new Set<string>();
	for (const n of techCatalog.names) set.add(n);
	for (const c of APP_CATEGORY_SLUGS) set.add(c);
	for (const a of SOURCE_IMPACT_AREAS) set.add(a);
	for (const t of extra) {
		const s = toSlug(t);
		if (s) set.add(s);
	}
	return [...set].sort();
}

/**
 * Live suggestions for a draft token: prefix matches first, then substring,
 * capped at `limit`. Empty token → no suggestions (never dump the whole list).
 */
export function suggestTags(
	token: string,
	vocab: string[],
	limit = 6,
): string[] {
	const t = token.trim().toLowerCase();
	if (!t) return [];
	const prefix: string[] = [];
	const substring: string[] = [];
	for (const v of vocab) {
		if (v.startsWith(t)) prefix.push(v);
		else if (v.includes(t)) substring.push(v);
		if (prefix.length >= limit) break;
	}
	return [...prefix, ...substring].slice(0, limit);
}
