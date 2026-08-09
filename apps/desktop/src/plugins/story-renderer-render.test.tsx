import { describe, expect, it } from "vitest";
import type { ExportableContent } from "@vorynth/types";
import {
	buildMarkdown,
	buildStoryHtml,
} from "../../plugins/story-renderer/src/index.js";

/**
 * Story Renderer render tests (v1.8.0) — the pure builders must turn bodies
 * into clean prose:
 *
 *   • a raw HTML body (content:encoded, API contentFields) is normalized to
 *     text FIRST — no source tag may leak into Markdown or HTML output, and
 *     no in-article link may survive as a link;
 *   • the only link an export carries is the story's own `content.url`;
 *   • markdown-structure leads are still escaped (plain-text contract kept).
 *
 * jsdom provides the DOM the HTML→text normalizer needs.
 */
const OPTS = { includeMetadata: true, preferTranslated: false };

function article(overrides: Partial<ExportableContent>): ExportableContent {
	return {
		kind: "article",
		title: "Test Story",
		body: "First paragraph.\n\nSecond paragraph.",
		url: "https://example.com/story",
		source: "Example",
		...overrides,
	};
}

describe("Story Renderer — clean prose, no tag/link leakage (v1.8.0)", () => {
	it("renders a plain-text body as prose with only the source link", () => {
		const body =
			"Hello world.\n\nSecond para with an inline URL https://x.com/y.";
		const md = buildMarkdown(article({ body }), OPTS);
		expect(md).toContain("Hello world.");
		expect(md).toContain("Source: https://example.com/story");
		// No <a> tags anywhere in the markdown — the source is a text line.
		expect(md).not.toMatch(/<\/?a[\s>]/i);

		const html = buildStoryHtml(article({ body }), OPTS);
		expect(html).toContain(`href="${"https://example.com/story"}"`);
		// The inline URL stays TEXT (escaped), never becomes a link element.
		expect(html).not.toContain('href="https://x.com/y"');
		expect(html).toContain("https://x.com/y.");
	});

	it("normalizes a raw HTML body to text — no source tag or sneaky link leaks", () => {
		const htmlBody =
			'<p>First <strong>bold</strong> para with a <a href="https://evil.example">sneaky link</a>.</p>' +
			"<h2>Subheading</h2>" +
			"<p>Second para.</p>";

		const md = buildMarkdown(article({ body: htmlBody }), OPTS);
		// Prose preserved (tags gone, link label kept as text).
		expect(md).toContain("First bold para with a sneaky link.");
		expect(md).toContain("Subheading");
		expect(md).toContain("Second para.");
		// Paragraph structure survives as separate paragraphs.
		expect(md).toMatch(/sneaky link\.\n\nSubheading/);
		// No raw source tag anywhere in the markdown.
		expect(md).not.toMatch(/<\/?(?:p|h2|a|strong)[\s>]/i);
		// The only link line is the story's own source URL.
		expect(md).toContain("Source: https://example.com/story");

		const html = buildStoryHtml(article({ body: htmlBody }), OPTS);
		// Escaped-literal tags (the old bug) must not appear.
		expect(html).not.toContain("&lt;p&gt;");
		expect(html).not.toContain("&lt;h2&gt;");
		expect(html).not.toContain("&lt;a");
		// The sneaky link's target never appears, and the only href is the source.
		expect(html).not.toContain("evil.example");
		expect(html).toContain('href="https://example.com/story"');
		// Link label text preserved as prose.
		expect(html).toContain("sneaky link");
	});

	it("escapes markdown-structure leads so prose is never parsed as markup", () => {
		const md = buildMarkdown(
			article({ body: "# Not a heading\n> Not a quote\n- Not a list" }),
			OPTS,
		);
		expect(md).toContain("\\# Not a heading");
		expect(md).toContain("\\> Not a quote");
		expect(md).toContain("\\- Not a list");
	});

	it("prefers the translated body when asked", () => {
		const md = buildMarkdown(
			article({ body: "Original", translatedBody: "Translated" }),
			{ includeMetadata: true, preferTranslated: true },
		);
		expect(md).toContain("Translated");
		expect(md).not.toContain("Original");
	});
});
