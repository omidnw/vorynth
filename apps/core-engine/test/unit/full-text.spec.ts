import type { Article } from "@vorynth/types";
import {
	enrichArticle,
	mapWithConcurrency,
} from "../../src/modules/crawler/full-text.js";
import { extractArticle } from "../../src/modules/crawler/adapters/html-extract.js";

/**
 * Full-text enrichment — offline unit tests with mocked fetch fixtures.
 * Tests never touch the network (testing-backend: no network).
 */

const ARTICLE_HTML = (
	title: string,
	body: string,
) => `<!doctype html><html><head><title>${title}</title></head><body>
  <article>
    <h1>${title}</h1>
    <p>${body}</p>
    <p>More body text.</p>
  </article>
</body></html>`;

/** A body long enough to clear the extraction quality floor (100 chars). */
function longBody(seed: string, count = 6): string {
	return Array.from({ length: count }, () => seed).join(" ");
}

function mockFetch(
	routes: Record<string, string | { ok: boolean; status: number }>,
): void {
	globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		const hit = routes[url];
		if (hit === undefined) return new Response("not found", { status: 404 });
		if (typeof hit !== "string")
			return new Response("", { status: hit.status, ok: hit.ok });
		return new Response(hit, {
			status: 200,
			headers: { "content-type": "text/html" },
		});
	}) as unknown as typeof fetch;
}

function makeArticle(overrides: Partial<Article>): Article {
	return {
		id: "art-1",
		sourceId: "src-1",
		title: "A Story",
		content: "Short snippet.",
		url: "https://example.com/story/1",
		author: null,
		publishedAt: new Date("2026-08-01T00:00:00Z"),
		collectedAt: new Date("2026-08-01T01:00:00Z"),
		hash: "h1",
		...overrides,
	};
}

describe("enrichArticle — full-text upgrade", () => {
	it("replaces a short feed snippet with the full extracted body", async () => {
		mockFetch({
			"https://example.com/story/1": ARTICLE_HTML(
				"A Story",
				longBody("The full article body with plenty of words."),
			),
		});
		const out = await enrichArticle(makeArticle({}));
		expect(out.content).toContain("The full article body");
		expect(out.content.length).toBeGreaterThan("Short snippet.".length);
	});

	it("fills an empty feed body from the page", async () => {
		mockFetch({
			"https://example.com/story/1": ARTICLE_HTML(
				"A Story",
				longBody("Full body text."),
			),
		});
		const out = await enrichArticle(makeArticle({ content: "" }));
		expect(out.content).toContain("Full body text.");
	});

	it("ignores a failed extraction below the quality floor", async () => {
		// An SPA shell / paywall / 404 page yields a few words of UI chrome —
		// never store it as an article body, even when the feed gave nothing.
		mockFetch({
			"https://example.com/story/1": ARTICLE_HTML(
				"Sign in",
				"Loading model card",
			),
		});
		const out = await enrichArticle(makeArticle({ content: "" }));
		expect(out.content).toBe("");
	});

	it("never downgrades content when extraction is shorter", async () => {
		mockFetch({
			"https://example.com/story/1": ARTICLE_HTML("A Story", "Tiny."),
		});
		const original =
			"A fairly long snippet that is longer than the tiny extracted body.";
		const out = await enrichArticle(makeArticle({ content: original }));
		expect(out.content).toBe(original);
	});

	it("repairs a flattened Cloudflare-shell body that also carries JSON markers", async () => {
		// The page carries the Cloudflare shell inside the extracted container
		// (nav dump + byline + prose with `{...}` code samples), like the real
		// blog. The stored body is the SAME page flattened — what the old
		// extractor stored — so isContentCorrupted is true and the
		// corrupted-vs-clean swap alone would reject the re-extraction; the
		// shell-repair rule accepts it once paragraph structure returns.
		const prose = longBody(
			"We are moving toward a world where every team ships code.",
			8,
		);
		const page = `<!doctype html><html><head><title>Run CI/CD</title></head><body>
  <article>
    <nav>BlogAgentsAgents Week+4Show 4 more tags7 TagsShow 7 tags</nav>
    <h1>Run CI/CD for millions of repos</h1>
    <p>${prose}</p>
    <p>Matt Silverlock10 minute readCOPY URL</p>
    <p>{"repo": "org/repo", "steps": ["build", "test"]}</p>
    <p>More body text.</p>
    <footer>Follow on Social MediaCloudflareSubscribe to receive notifications of new posts</footer>
  </article>
</body></html>`;
		mockFetch({ "https://example.com/story/1": page });
		const expected = extractArticle(
			page,
			"https://example.com/story/1",
			{},
		).content.trim();
		const stored = expected
			.replace(/\n{2,}/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		const out = await enrichArticle(makeArticle({ content: stored }), {
			force: true,
		});
		expect(out.content).toBe(expected);
		expect(out.content).toContain("\n\n");
	});

	it("skips the fetch when the feed already provides full text", async () => {
		const long = "x".repeat(900);
		mockFetch({});
		const out = await enrichArticle(makeArticle({ content: long }));
		expect(out.content).toBe(long);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("keeps the snippet when the page can't be fetched", async () => {
		mockFetch({});
		const out = await enrichArticle(makeArticle({}));
		expect(out.content).toBe("Short snippet.");
	});

	it("falls back to the Wayback Machine when the origin 403s", async () => {
		// openai.com and other bot-protected sites refuse every non-browser
		// client — fetchPage retries through the nearest archive snapshot.
		mockFetch({
			"https://example.com/story/1": { ok: false, status: 403 },
			"https://web.archive.org/web/2/https://example.com/story/1": ARTICLE_HTML(
				"A Story",
				longBody("The archived full body."),
			),
		});
		const out = await enrichArticle(makeArticle({}));
		expect(out.content).toContain("The archived full body");
	});

	it("keeps the snippet when both the origin and Wayback fail", async () => {
		mockFetch({
			"https://example.com/story/1": { ok: false, status: 403 },
			// no wayback route → 404 → snippet kept
		});
		const out = await enrichArticle(makeArticle({}));
		expect(out.content).toBe("Short snippet.");
	});

	it("skips non-http URLs entirely", async () => {
		mockFetch({});
		const out = await enrichArticle(
			makeArticle({ url: "mailto:hi@example.com" }),
		);
		expect(out.content).toBe("Short snippet.");
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});

describe("mapWithConcurrency", () => {
	it("maps every item with bounded concurrency", async () => {
		const seen: number[] = [];
		const out = await mapWithConcurrency(
			[1, 2, 3, 4, 5],
			async (n) => {
				seen.push(n);
				return n * 2;
			},
			2,
		);
		expect(out).toEqual([2, 4, 6, 8, 10]);
		expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
	});

	it("returns [] for an empty input", async () => {
		await expect(mapWithConcurrency([], async (n) => n)).resolves.toEqual([]);
	});
});
