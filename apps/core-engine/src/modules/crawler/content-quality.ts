/**
 * Content-quality heuristics (v1.8.0) — detect damaged article bodies and
 * incomplete translations so the health check and the per-story Re-collect
 * button can repair them.
 *
 * The signals are deliberately conservative: a false positive only means a
 * story gets re-fetched/re-translated once (Re-collect is always available
 * manually); a false negative leaves the snippet in place (never a downgrade).
 * These are heuristics, not language detection — an incomplete translation is
 * recognized by leftover placeholders and by being implausibly short relative
 * to the original, not by checking fluency.
 *
 * v1.8.0 tightening: the damage signals were narrowed to ones distinctive of
 * page-interface leaks (media-player JSON keys, double-bracket template tokens,
 * long JSON-object runs) — common legit content ({{mustache}} in tutorials,
 * "Posted in:" footers, `\uXXXX` in code samples, generic "browser does not
 * support X" prose) no longer triggers the "looks damaged" note.
 */

/** Single-level JSON-object runs with a quoted key, e.g.
 *  {"play_video": "Play video", ...}. The quoted key distinguishes data blobs
 *  from {{mustache}}/{{ x }} template syntax, which must never be flagged. */
const JSON_BLOB = /\{[^{}]*"[^{}]{10,}\}/;

/** Leftover double-bracket template tokens from JS-rendered pages:
 *  [[read-time]], [[duration]] — the Next.js/Google-blog style shell leak. */
const TEMPLATE_TOKEN = /\[\[[a-z0-9_-]+\]\]/i;

/** Media-player JSON keys + the audio/video fallback phrase — page-interface
 *  chrome that has no place in an article body. */
const UI_CHROME =
	/\bplay_video\b|\bpause_video\b|\benable_captions\b|\baria_value_text\b|\blisten to article\b|\bbrowser does not support the (audio|video) element\b/i;

/**
 * True when a stored article body looks damaged — inline JSON data blobs,
 * double-bracket template tokens, or media-player UI chrome leaked into the
 * text (the exact junk `extractArticle` used to capture from `<script>`/
 * `<audio>`).
 */
export function isContentCorrupted(content: string): boolean {
	if (!content) return false;
	return (
		JSON_BLOB.test(content) ||
		TEMPLATE_TOKEN.test(content) ||
		UI_CHROME.test(content)
	);
}

// ── Page-shell leaks (captured page chrome around the prose) ────────────────

/** Cloudflare-blog shell (v1.8.0): generic extraction captures the page dump —
 *  a long nav/tag list, then a byline ending in the share button
 *  "N minute readCOPY URL", then the prose, then a "Follow on Social Media" +
 *  newsletter footer. The concatenated byline marker is distinctive of the
 *  shell — real prose never reads "7 minute readCOPY URL". */
const CF_BYLINE = /\d+ minute read\s*COPY URL/i;

/** AWS News/Security blog shell: the metadata header (title + "by <author> on
 *  <date> in <categories>") ends with the share bar "Permalink Comments
 *  Share". */
const AWS_HEAD = /\bPermalink\s+Comments\s+Share\b/;

/** Tail chrome that follows the prose across blogs: the page's comment stub,
 *  tag list, newsletter, or related-articles footer. Cut from the earliest
 *  marker — title-case UI headings, not prose (case-sensitive so "tags:" /
 *  "keep reading" in body text never matches). */
const TAIL_CHROME =
	/Loading comments|TAGS:|POSTED IN:|Keep reading|Explore more on|Get Featured Next Month|On this page|Discuss Online|Follow on Social Media/;

/**
 * True when a stored body carries a page-shell leak captured around the prose
 * (Cloudflare-blog style: nav dump + byline + share button + newsletter
 * footer; AWS-blog style: metadata header + comments stub). Unlike
 * `isContentCorrupted`, this is NOT re-fetchable damage — re-collecting the
 * same page captures the same shell — so it drives only the read-time
 * cleanup, never the repair/health-check path (and the UI shows the cleaned
 * prose without a "looks damaged" note or a Re-collect that can't help).
 */
export function hasShellLeak(content: string): boolean {
	if (!content) return false;
	return CF_BYLINE.test(content) || AWS_HEAD.test(content);
}

/**
 * A shell-leak body still needs re-extraction when it was captured before the
 * paragraph-break fix — its prose reads as one wall of words. Re-extracting
 * with the block-boundary extractor stores `\n\n` paragraph breaks, so this
 * flips to false and the repair runs exactly once per article.
 */
export function needsShellRepair(content: string): boolean {
	if (!content) return false;
	return hasShellLeak(content) && !content.includes("\n\n");
}

/**
 * A long body with no paragraph breaks was flattened by the old extractor
 * (regardless of whether it carries shell chrome) — re-extracting it once
 * restores readable paragraphs. Short bodies (< 1500 chars) are snippets or
 * feed-provided single paragraphs and are left alone.
 */
export function needsParagraphRepair(content: string): boolean {
	if (!content) return false;
	return content.length >= 1500 && !content.includes("\n\n");
}

// ── Presentation cleanup ────────────────────────────────────────────────────

/** JSON-object runs with a quoted key, e.g. {"play_video": "Play video", ...}. */
const CLEAN_JSON = /\{[^{}]*"[^{}]{10,}\}/g;
/** Double-bracket tokens and \uXXXX escapes. */
const CLEAN_TOKENS = /\[\[[a-z0-9_-]+\]\]|\\u[0-9a-f]{4}/gi;
/** Audio/video player fallback + the page's share/newsletter/breadcrumb bar. */
const CLEAN_PLAYER =
	/\bYour browser does not support the (audio|video) element\b|\bListen to article\b/gi;
/** The Google-blog-style shell: breadcrumbs, share bars, AI-summary chrome. */
const CLEAN_SHELL = new RegExp(
	[
		"Breadcrumb",
		"Copy link",
		"(?:Share\\s+)?x\\.com Facebook LinkedIn Mail(?:\\s+Copy link)?",
		"This content is generated by Google AI",
		"Generative AI is experimental",
		"Read AI-generated summary",
		"Summaries were generated by Google AI",
		"Explore other styles:",
		"Voice Speed",
		"Get the latest news from Google in your inbox",
		"Sign up for our newsletters",
		"Done\\. Just one step more",
		"Check your inbox to confirm your subscription",
		"POSTED IN:",
	].join("|"),
	"gi",
);
/** Playback-speed labels ("0.75X 1X 1.5X 2X") — UI chrome, not prose. */
const CLEAN_SPEED = /\b\d+(?:\.\d+)?X\b/g;
/** Reading-time labels ("11 min read", "26 minute read") — UI chrome. No
 *  trailing boundary: flattened text concatenates the next label directly
 *  ("11 min readWallpaper"). */
const CLEAN_READTIME = /\b\d+ (?:min|minute) read/i;

/**
 * True when a body's real title appears early but not at the very start —
 * flattened metadata/chips (date, author, category, tags) precede it
 * (OpenAI / Netflix / Smashing-blog style). The read-time cleanup cuts the
 * prefix and the title is re-rendered from the title field. A title at
 * position 0 is the normal case and is never treated as chrome.
 */
export function hasHeadChrome(content: string, title?: string | null): boolean {
	if (!content || !title) return false;
	if (title.length >= content.length) return false;
	const at = content.indexOf(title);
	return at > 0 && at < 400;
}

/**
 * Presentation cleanup for damaged bodies (v1.8.0).
 *
 * Some stored texts ARE the page's captured junk (JSON blobs, template tokens,
 * media-player/share/newsletter chrome) and can't be re-fetched from a blocked
 * origin. This strips the interface noise so the article's actual prose is
 * readable — applied ONLY when `isContentCorrupted` (or `hasShellLeak`) and
 * never persisted (the stored content stays canonical, R-A05). When `title` is
 * given and found near the start, the leading breadcrumb/share prefix before
 * it is dropped too.
 */
export function cleanCollectedText(
	content: string,
	title?: string | null,
): string {
	let text = content ?? "";

	// Cloudflare-blog shell: the prose starts right after the byline
	// ("N minute readCOPY URL"). Drop the nav/tag dump before it.
	const cfAt = text.search(CF_BYLINE);
	const cfCleaned = cfAt > 0;
	if (cfCleaned) {
		text = text.slice(cfAt).replace(CF_BYLINE, " ");
	}
	// AWS-blog shell: the metadata header ("… by <author> on <date> in
	// <categories> Permalink Comments Share") precedes the prose. Drop the
	// header up to the share bar.
	const awsAt = text.search(AWS_HEAD);
	const awsCleaned = awsAt >= 0;
	if (awsCleaned) {
		text = text.slice(awsAt).replace(AWS_HEAD, " ");
	}
	// Tail chrome: the page's footer/related/promo blocks that follow the
	// prose (Cloudflare newsletter, AWS comments stub, Google POSTED IN tags,
	// OpenAI "Keep reading" related list, Smashing promo). Cut from the
	// earliest marker — these are title-case UI headings, not prose.
	const tailAt = text.search(TAIL_CHROME);
	if (tailAt > 0) {
		text = text.slice(0, tailAt);
	}

	text = text
		.replace(CLEAN_SHELL, " ")
		.replace(CLEAN_PLAYER, " ")
		.replace(CLEAN_JSON, " ")
		.replace(CLEAN_TOKENS, " ")
		.replace(CLEAN_SPEED, " ")
		.replace(CLEAN_READTIME, " ")
		.replace(/\s*\|\s*/g, " ");
	// Collapse whitespace but PRESERVE paragraph breaks — extraction stores
	// `\n\n` at block boundaries; flattening it back makes the prose a wall of
	// words again.
	text = text
		.replace(/[ \t]+/g, " ")
		.replace(/ ?\n ?/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

	// Drop a leading breadcrumb/share prefix when the real title shows up early.
	// (Shell-leak bodies already had their prefix cut with the byline — the
	// title lives in the removed byline, so re-running this on the prose could
	// wrongly trim the article's intro when the title recurs as a heading.)
	if (!cfCleaned && !awsCleaned && title && text.length > title.length) {
		const at = text.indexOf(title);
		if (at > 0 && at < 400) {
			text = text.slice(at);
		}
	}
	return text;
}

/** Translated text at or below this share of the original length is treated as
 *  truncated/partial (translations run 60-80% of the source in practice). */
const MIN_TRANSLATION_RATIO = 0.35;
/** Only judge length ratios against originals that are long enough to matter. */
const MIN_ORIGINAL_CHARS = 100;

/**
 * True when a stored translation should be redone: missing entirely, or
 * carrying leftover double-bracket template tokens / escaped-unicode leaks, or
 * implausibly short vs the original. ({{mustache}} is NOT a leak here either —
 * tutorials legitimately contain it.)
 */
export function translationIsIncomplete(
	original: string,
	translation: string | null | undefined,
): boolean {
	const t = (translation ?? "").trim();
	if (!t) return true;
	const o = original.trim();
	if (!o) return false; // nothing to translate — nothing can be incomplete
	if (TEMPLATE_TOKEN.test(t)) return true;
	if (/\\u[0-9a-f]{4}/i.test(t)) return true;
	if (
		o.length >= MIN_ORIGINAL_CHARS &&
		t.length < o.length * MIN_TRANSLATION_RATIO
	) {
		return true;
	}
	return false;
}
