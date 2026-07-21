/**
 * Text normalization and tokenization for Vorynth full-text search.
 *
 * Uses established libraries — no hand-rolled logic:
 *   • @persian-tools/persian-tools — Persian character unification
 *   • Intl.Segmenter                — ICU-based word boundary detection
 *   • String.normalize('NFKC')      — Unicode normalization
 */
import { toPersianChars, digitsEnToFa } from "@persian-tools/persian-tools";

// ── Constants ──────────────────────────────────────────────────────────────

/** Characters that have special meaning in FTS5 queries and must be escaped. */
const FTS5_SPECIAL = /["^*()+\-!~:]/g;

/** FTS5 boolean operators — if a token is one of these, treat it as literal. */
const FTS5_OPS = new Set(["AND", "OR", "NOT"]);

/** Max tokens allowed in a query to avoid abuse. */
const MAX_TOKENS = 12;

/** Min token length (inclusive). */
const MIN_TOKEN_LEN = 2;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Normalize text for consistent indexing and querying.
 *
 * Pipeline:
 *   1. NFKC Unicode normalization (built-in JS)
 *   2. Persian digit conversion (123 → ۱۲۳)
 *   3. Persian character unification (ك → ک, ي → ی, ة → ه)
 *
 * This is registered in SQLite as `normalize_fts()` via better-sqlite3's
 * `.function()` API so triggers can call it transparently.
 */
export function normalizeText(text: string): string {
	return toPersianChars(
		// @persian-tools: unifies Arabic/Persian letter variants
		digitsEnToFa(
			// @persian-tools: "123" → "۱۲۳"
			text.normalize("NFKC"), // built-in JS: composed → compatibility composed
		),
	);
}

/**
 * Split a user search query into normalized tokens using ICU word boundaries.
 *
 * Uses `Intl.Segmenter` with locale `['en', 'fa', 'ar']` so Persian and
 * Arabic words are correctly identified regardless of whitespace conventions.
 *
 * Returns a deduplicated array of tokens, capped at MAX_TOKENS.
 */
export function tokenizeQuery(query: string): string[] {
	const normalized = normalizeText(query);
	const words: string[] = [];

	// Intl.Segmenter — ICU-based word segmentation (built-in Node.js 20+)
	const segmenter = new Intl.Segmenter(["en", "fa", "ar"], {
		granularity: "word",
	});

	for (const seg of segmenter.segment(normalized)) {
		if (!seg.isWordLike) continue;
		const token = seg.segment.toLowerCase().replace(FTS5_SPECIAL, " ").trim();
		if (token.length < MIN_TOKEN_LEN) continue;
		if (FTS5_OPS.has(token.toUpperCase())) continue;
		words.push(token);
	}

	return [...new Set(words)].slice(0, MAX_TOKENS);
}

/**
 * Escape a single token for safe use in an FTS5 MATCH query.
 *
 * Wraps in double quotes so special characters are treated literally.
 * Handles tokens that themselves contain double quotes by doubling them
 * (standard SQLite escape).
 */
export function escapeFtsToken(token: string): string {
	const escaped = token.replace(/"/g, '""');
	return `"${escaped}"`;
}

/**
 * Build an FTS5 query string from user tokens with AND fallback to OR.
 *
 * Returns `{ andQuery, orQuery }` so the caller can try AND first,
 * then fall back to OR if no results.
 */
export function buildFtsQuery(
	tokens: string[],
): { andQuery: string; orQuery: string } | null {
	if (tokens.length === 0) return null;

	const quoted = tokens.map(escapeFtsToken);
	return {
		andQuery: quoted.join(" "), // implicit AND
		orQuery: quoted.join(" OR "), // explicit OR
	};
}
