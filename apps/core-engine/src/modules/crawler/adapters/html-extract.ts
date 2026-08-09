import * as cheerio from "cheerio";
import { Logger } from "@nestjs/common";

/**
 * Shared HTML fetching/extraction for the v1.8.0 page-crawling adapters
 * (html, sitemap). Kept adapter-independent so both can reuse it.
 *
 * Uses cheerio for selector-based extraction (the engine has no DOM library —
 * media.service uses regex scans because it only needs URLs; crawling needs
 * real selectors, hence the dependency, see R-D05).
 */

export interface PageSelectors {
	titleSelector?: string;
	contentSelector?: string;
	dateSelector?: string;
	authorSelector?: string;
}

export interface ExtractedPage {
	title: string;
	content: string;
	url: string;
	author?: string;
	publishedAt?: Date;
}

const logger = new Logger("HtmlExtract");

const USER_AGENT =
	"Mozilla/5.0 (compatible; Vorynth/1.0; +https://vorynth.local)";

const FETCH_TIMEOUT_MS = 20_000;
/** Wayback gets a shorter budget — a slow archive must not stall a whole
 *  collect/health run on top of the origin's 20s timeout. */
const WAYBACK_TIMEOUT_MS = 15_000;

/**
 * Fetch a URL as text with a timeout + UA (matches media.service pattern).
 *
 * When the origin refuses us with 403 (bot protection — openai.com and other
 * Cloudflare-fronted sites block every non-browser client), retry through the
 * Wayback Machine's nearest snapshot (`/web/2/`) so stored articles can still
 * get their full text. Best-effort: any failure keeps the caller's snippet —
 * enrichment never downgrades stored content.
 */
export async function fetchPage(url: string): Promise<string | null> {
	const direct = await fetchRaw(url, FETCH_TIMEOUT_MS);
	if (direct.body !== null) return direct.body;
	if (direct.status === 403) {
		const archived = await fetchRaw(waybackUrl(url), WAYBACK_TIMEOUT_MS);
		if (archived.body !== null) {
			logger.log(`fetchPage ${url} → served from wayback`);
			return archived.body;
		}
	}
	if (direct.error) {
		logger.warn(`fetchPage failed for ${url}: ${direct.error}`);
	} else {
		logger.warn(`fetchPage ${url} → ${direct.status}`);
	}
	return null;
}

async function fetchRaw(
	url: string,
	timeoutMs: number,
): Promise<{ status: number; body: string | null; error?: string }> {
	try {
		const res = await fetch(url, {
			headers: { "user-agent": USER_AGENT },
			redirect: "follow",
			signal: AbortSignal.timeout(timeoutMs),
		});
		if (!res.ok) return { status: res.status, body: null };
		return { status: res.status, body: await res.text() };
	} catch (err) {
		return { status: 0, body: null, error: (err as Error).message };
	}
}

/** Wayback snapshot URL — `/web/2/` resolves to the nearest snapshot. */
function waybackUrl(url: string): string {
	return `https://web.archive.org/web/2/${url}`;
}

/**
 * Extract title/content/date/author from a page's HTML using CSS selectors.
 * Falls back to common patterns when a selector is missing.
 */
export function extractArticle(
	html: string,
	url: string,
	selectors: PageSelectors,
): ExtractedPage {
	const $ = cheerio.load(html);

	// Cheerio's `.text()` concatenates every descendant text node — including
	// the contents of `<script>`/`<style>` (inline JSON state, JSON-LD) and the
	// fallback text inside `<audio>`/`<video>` ("Your browser does not support
	// the audio element."). Strip those before extraction so the body is the
	// article's prose, not the page's UI chrome (v1.8.0 content-quality fix).
	$(
		"script, style, noscript, template, svg, audio, video, canvas, iframe",
	).remove();

	// Paragraph breaks at block boundaries (v1.8.0 readability fix): `.text()`
	// otherwise concatenates every text node with no separator, flattening
	// paragraphs/headings/lists into one wall of words ("...every team.Set the
	// ground rulesWe started..."). A break after each block element (<br> gets
	// a single line break) and normalizeWs below preserve the structure.
	prepareDocument($);

	const title =
		firstText($, selectors.titleSelector) ??
		$("h1").first().text().trim() ??
		$("title").first().text().trim() ??
		"";

	const content =
		firstText($, selectors.contentSelector) ??
		$("article").first().text().trim() ??
		$("main").first().text().trim() ??
		"";

	const dateStr =
		firstDateTime($, selectors.dateSelector) ??
		$("time").first().attr("datetime");
	const author = firstText($, selectors.authorSelector) || undefined;

	let publishedAt: Date | undefined;
	if (dateStr) {
		const d = new Date(dateStr);
		if (!Number.isNaN(d.getTime())) publishedAt = d;
	}

	return {
		title: normalizeWs(title),
		content: cleanBody(content).slice(0, 50_000),
		url,
		author: author ? normalizeWs(author) : undefined,
		publishedAt,
	};

	function firstText(
		$root: cheerio.CheerioAPI,
		selector?: string,
	): string | null {
		if (!selector) return null;
		try {
			const el = $root(selector).first();
			if (el.length === 0) return null;
			return el.text().trim() || (el.attr("content") ?? "").trim() || null;
		} catch {
			return null; // invalid selector → fall through to defaults
		}
	}

	/** For dates, prefer the element's `datetime` attribute over its text. */
	function firstDateTime(
		$root: cheerio.CheerioAPI,
		selector?: string,
	): string | null {
		if (!selector) return null;
		try {
			const el = $root(selector).first();
			if (el.length === 0) return null;
			const dt = el.attr("datetime")?.trim();
			if (dt) return dt;
			const text = el.text().trim();
			return text || (el.attr("content") ?? "").trim() || null;
		} catch {
			return null; // invalid selector → fall through to defaults
		}
	}
}

/**
 * Prepare a loaded document for text extraction (v1.8.0):
 *   1. Drop UI chrome — scripts, styles, media fallbacks, iframes (their text
 *      is page furniture, not the article).
 *   2. Turn `<table>`s into readable markdown pipe blocks BEFORE the
 *      block-break pass — otherwise each cell flattens into its own
 *      line-separated fragment and the table reads as a jumbled wall
 *      (HashiCorp-style tables were the exact symptom).
 *   3. Mark block boundaries so `.text()` keeps paragraph breaks.
 */
function prepareDocument($: cheerio.CheerioAPI): void {
	// Cheerio's `.text()` concatenates every descendant text node — including
	// the contents of `<script>`/`<style>` (inline JSON state, JSON-LD) and the
	// fallback text inside `<audio>`/`<video>` ("Your browser does not support
	// the audio element."). Strip those before extraction so the body is the
	// article's prose, not the page's UI chrome (v1.8.0 content-quality fix).
	$(
		"script, style, noscript, template, svg, audio, video, canvas, iframe",
	).remove();

	$("table").each((_, table) => {
		const md = tableToMarkdown($, $(table));
		if (md) $(table).replaceWith(`<div>\n${md}\n</div>`);
		else $(table).remove();
	});

	// <br> gets a single line break; every block element a paragraph break.
	$("br").replaceWith("\n");
	$(
		"p, div, h1, h2, h3, h4, h5, h6, li, ul, ol, blockquote, pre, figcaption, summary, details, hr, table, tr, td, th, header, footer, section, article, aside, nav, main",
	).each((_, el) => {
		$(el).after("\n\n");
	});
}

/**
 * Convert a `<table>` into a markdown pipe block — one line per row, cells in
 * order, pipe characters escaped. Returns "" for an empty/headerless table
 * (the caller drops it).
 */
function tableToMarkdown(
	$: cheerio.CheerioAPI,
	$table: ReturnType<typeof $>,
): string {
	const rows: string[][] = [];
	$table.find("tr").each((_, tr) => {
		const cells: string[] = [];
		$(tr)
			.find("th, td")
			.each((_, cell) => {
				const text = normalizeWs($(cell).text())
					.replace(/\n+/g, " ")
					.replace(/\|/g, "\\|");
				cells.push(text);
			});
		if (cells.length > 0) rows.push(cells);
	});
	if (rows.length === 0) return "";
	const width = Math.max(...rows.map((r) => r.length));
	const line = (cells: string[]) => {
		const c = [...cells];
		while (c.length < width) c.push("");
		return `| ${c.join(" | ")} |`;
	};
	const out = [line(rows[0]!), `| ${Array(width).fill("---").join(" | ")} |`];
	for (const r of rows.slice(1)) out.push(line(r));
	return out.join("\n");
}

/**
 * Convert arbitrary HTML — feed `content:encoded`, a whole page — into
 * readable text with paragraph breaks preserved and tables as markdown
 * blocks. The same extraction the page crawlers use; the RSS adapter runs
 * feed HTML through this so it reads like extracted prose instead of
 * rss-parser's naive tag-strip (which flattens tables into a wall of cells).
 */
export function htmlToReadableText(html: string): string {
	const $ = cheerio.load(html);
	prepareDocument($);
	return cleanBody($("body").first().text() ?? "");
}

/** Resolve a possibly-relative URL against a base URL. */
export function resolveUrl(rel: string, baseUrl: string): string {
	try {
		return new URL(rel, baseUrl).href;
	} catch {
		return rel;
	}
}

/**
 * Collapse whitespace but PRESERVE paragraph breaks (v1.8.0 readability):
 * extraction inserts `\n\n` at block boundaries, so a blank line is a real
 * paragraph boundary in the flattened text. Collapse horizontal whitespace,
 * strip stray spaces around newlines, and clamp 3+ newlines to one blank
 * line — never collapse `\n\n` back into a single space, or the body reads as
 * one wall of words again.
 */
function normalizeWs(s: string): string {
	return (
		s
			// Non-breaking spaces are layout artifacts (feed HTML is full of them);
			// collapse them with regular spaces so words don't glue together.
			.replace(/[\u00a0 \t]+/g, " ")
			.replace(/ ?\n ?/g, "\n")
			.replace(/\n{3,}/g, "\n\n")
			.trim()
	);
}

/**
 * Strip residual extraction junk from a body: single-level JSON data blobs
 * (e.g. `{"play_video": "Play video", ...}`) that survived outside `<script>`
 * tags, then collapse whitespace. Prose rarely contains `{...}` runs this
 * long, so removing them is a safe readability trade-off.
 */
function cleanBody(s: string): string {
	const withoutJson = s.replace(/\{[^{}]{10,}\}/g, " ");
	return normalizeWs(withoutJson);
}
