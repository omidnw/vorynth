import type { Article } from "@vorynth/types";
import { extractArticle, fetchPage } from "./adapters/html-extract.js";
import { isContentCorrupted } from "./content-quality.js";

/**
 * Full-text enrichment (v1.8.0) — turns a feed snippet into the article's
 * full body.
 *
 * Most feeds (RSS included) only publish a short description per item; the
 * article itself lives at `item.url`. This helper fetches that page and
 * extracts the full text with the same generic extraction the html/sitemap
 * adapters use, then swaps it in when it is meaningfully longer than what the
 * feed provided. On ANY failure the original content is kept untouched —
 * enrichment is a best-effort upgrade, never a data-loss path.
 *
 * The dedup hash only covers title + publishedAt + sourceId (see
 * CrawlerService), so upgrading `content` here is safe: a re-collect keeps the
 * same hash and the enriched row is preserved — and once an article carries
 * full text it is never re-fetched again.
 */

/** Content at or above this length is treated as already full (GitHub release
 *  bodies, full-content feeds like web.dev) and is never re-fetched. */
const FULL_TEXT_MIN_CHARS = 800;

/** Below this, an extracted body is treated as a failed extraction (an SPA
 *  shell, paywall, or 404 page) rather than a real article — never store it,
 *  even when the feed gave nothing. */
const MIN_EXTRACTED_CHARS = 100;

/** Enrichment is network I/O — how many article pages to fetch at once. */
const ENRICH_CONCURRENCY = 4;

/**
 * Best-effort full-text upgrade for one article. Returns the article unchanged
 * when there is nothing to improve (no URL, already-full content) or when the
 * page can't be fetched/extracted into more text than the feed already gave.
 *
 * `force` (v1.8.0 re-collect / corruption repair): bypasses the already-full
 * guard so stored content — even a long, damaged body — can be re-extracted
 * from the origin. The replacement rule still protects quality: fresh text must
 * clear the floor AND either be longer than the stored body or swap damaged
 * content for clean content.
 */
export async function enrichArticle(
	article: Article,
	opts?: { force?: boolean },
): Promise<Article> {
	const url = article.url?.trim();
	if (!url || !/^https?:\/\//i.test(url)) return article;

	const current = (article.content ?? "").trim();
	// A feed that already provides the full text shouldn't trigger a page fetch
	// for every item on every run. Force (re-collect/repair) always re-fetches.
	if (!opts?.force && current.length >= FULL_TEXT_MIN_CHARS) return article;

	const html = await fetchPage(url);
	if (!html) return article;

	const page = extractArticle(html, url, {});
	const full = (page.content ?? "").trim();
	// Only upgrade when extraction produced real text: it must clear the
	// quality floor (an SPA shell / 404 page isn't a full article) AND be more
	// than what the feed gave (or the feed gave nothing at all) — or, when the
	// stored body is damaged, be clean where the stored body was not.
	if (!full || full.length < MIN_EXTRACTED_CHARS) return article;
	const currentCorrupted = isContentCorrupted(current);
	// Flattened bodies (captured before the paragraph-break fix) get repaired
	// when the re-extraction carries paragraph structure and isn't a
	// short/failed page — this covers shell-leak (Cloudflare/AWS), head-chrome
	// (OpenAI/Netflix/Smashing) AND corrupted-but-still-chromey bodies
	// (Google-blog style), where the corrupted→clean swap alone would reject
	// the re-extraction because code samples keep `{...}`/`[[...]]` markers in
	// both versions.
	const flattened = !current.includes("\n\n");
	const better = flattened
		? full.includes("\n\n") && full.length >= current.length * 0.7
		: currentCorrupted
			? !isContentCorrupted(full)
			: full.length > current.length;
	if (!better) return article;

	return {
		...article,
		content: full,
		// Fill the author only when the feed didn't provide one (publishedAt is
		// left untouched — it feeds the dedup hash).
		...(article.author ? {} : page.author ? { author: page.author } : {}),
	};
}

/**
 * Map over items with bounded concurrency. Enrichment is I/O-bound; crawling
 * a source with many new items must not fire N unbounded requests at once.
 */
export async function mapWithConcurrency<T>(
	items: T[],
	fn: (item: T) => Promise<T>,
	concurrency = ENRICH_CONCURRENCY,
): Promise<T[]> {
	if (items.length === 0) return [];
	const out = new Array<T>(items.length);
	let next = 0;
	const workers = Array.from(
		{ length: Math.min(concurrency, items.length) },
		async () => {
			for (;;) {
				const i = next++;
				if (i >= items.length) return;
				out[i] = await fn(items[i]!);
			}
		},
	);
	await Promise.all(workers);
	return out;
}

export { ENRICH_CONCURRENCY, FULL_TEXT_MIN_CHARS, MIN_EXTRACTED_CHARS };
