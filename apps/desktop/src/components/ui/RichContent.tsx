import DOMPurify from "dompurify";
import { useMemo } from "react";

/**
 * Renders collected story text safely (v1.8.0).
 *
 * Some feeds publish full HTML bodies (`content:encoded`) — those must render
 * their formatting (bold, links, lists) instead of showing raw tags, but the
 * markup is untrusted external data, so it goes through DOMPurify with a
 * conservative allowlist. Plain-text bodies (the common case after extraction)
 * render exactly as before with `whitespace-pre-wrap`.
 *
 * The stored `content` is never modified — sanitization is presentation-only
 * (R-A05: collected facts stay canonical).
 */

/** Content tags worth detecting so rich bodies take the HTML path. */
const KNOWN_TAGS =
	"(?:p|div|br|strong|b|em|i|u|s|a|ul|ol|li|h[1-6]|blockquote|code|pre|span|hr|" +
	"table|thead|tbody|tr|th|td|figure|figcaption|mark|small|sub|sup|del|ins|q|" +
	"cite|abbr|time|dl|dt|dd|img|video|audio|iframe|script|style|section|article|header|footer|nav|aside|main)";
const HTML_RE = new RegExp(`<\\/?(?:${KNOWN_TAGS})[\\s>]`, "i");

/** Tags allowed through the sanitizer. Deliberately no `img` (privacy), no
 *  `style`/`class` attributes, no `script`/`iframe`/`object`. */
const ALLOWED_TAGS = [
	"p",
	"div",
	"br",
	"strong",
	"b",
	"em",
	"i",
	"u",
	"s",
	"a",
	"ul",
	"ol",
	"li",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"blockquote",
	"code",
	"pre",
	"span",
	"hr",
	"table",
	"thead",
	"tbody",
	"tr",
	"th",
	"td",
];

// Links open in a new tab and never hand the opener a reference — added AFTER
// sanitization so the source markup's own target/rel can't sneak through.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
	if (node.tagName === "A" && node.getAttribute("href")) {
		node.setAttribute("target", "_blank");
		node.setAttribute("rel", "noopener noreferrer");
	}
});

/** True when a body looks like HTML rather than plain text. */
export function isHtml(text: string): boolean {
	return HTML_RE.test(text);
}

/** Strip all tags — used for plain-text previews (e.g. the brief card
 *  snippet) where rendering markup would be noise. */
export function stripHtml(text: string): string {
	return (text ?? "").replace(/<[^>]*>/g, " ");
}

function sanitizeHtml(dirty: string): string {
	return DOMPurify.sanitize(dirty, {
		ALLOWED_TAGS,
		ALLOWED_ATTR: ["href", "title"],
	});
}

/**
 * Render one body: sanitized HTML when it carries markup, plain pre-wrapped
 * text otherwise. `className` is applied to both variants so the caller keeps
 * its reading-column sizing.
 */
export function RichContent({
	text,
	dir,
	className = "",
}: {
	text: string;
	dir?: string;
	className?: string;
}) {
	const html = useMemo(() => {
		const t = text ?? "";
		return isHtml(t) ? sanitizeHtml(t) : null;
	}, [text]);

	if (html === null) {
		return (
			<p className={`whitespace-pre-wrap ${className}`} dir={dir}>
				{text}
			</p>
		);
	}
	return (
		<div
			className={`rich-content ${className}`}
			dir={dir}
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
