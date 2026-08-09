import { HtmlAdapter } from "../../src/modules/crawler/adapters/html-adapter.js";

/**
 * HTML crawler adapter — offline unit tests with mocked fetch fixtures.
 * Tests never touch the network (testing-backend: no network).
 */

const LISTING_HTML = `<!doctype html><html><head><title>My Blog</title></head><body>
  <article class="post">
    <h2 class="post-title"><a href="/p/one">First post</a></h2>
    <time datetime="2026-08-01T09:00:00Z">Aug 1</time>
  </article>
  <article class="post">
    <h2 class="post-title"><a href="/p/two">Second post</a></h2>
    <time datetime="2026-08-02T10:00:00Z">Aug 2</time>
  </article>
  <article class="post">
    <h2 class="post-title"><a href="/p/three">Third post</a></h2>
    <time datetime="2026-08-03T11:00:00Z">Aug 3</time>
  </article>
</body></html>`;

const ARTICLE_HTML = (
	title: string,
	body: string,
) => `<!doctype html><html><head><title>${title}</title></head><body>
  <article class="entry">
    <h1 class="entry-title">${title}</h1>
    <p class="entry-meta"><span class="author">Jane Doe</span><time datetime="2026-08-01T09:00:00Z">Aug 1</time></p>
    <div class="entry-content"><p>${body}</p><p>More text.</p></div>
  </article>
</body></html>`;

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

describe("HtmlAdapter", () => {
	let adapter: HtmlAdapter;
	beforeEach(() => {
		adapter = new HtmlAdapter();
	});

	describe("validate", () => {
		it("accepts a crawl.url http config", () => {
			expect(adapter.validate({ crawl: { url: "https://example.com" } })).toBe(
				true,
			);
		});
		it("rejects missing or non-http url", () => {
			expect(adapter.validate({})).toBe(false);
			expect(adapter.validate({ crawl: { url: "not-a-url" } })).toBe(false);
		});
	});

	describe("single-page mode (no itemSelector)", () => {
		it("extracts title/content/date/author from one article page", async () => {
			mockFetch({
				"https://example.com/post": ARTICLE_HTML(
					"Hello World",
					"Body text here",
				),
			});
			const items = await adapter.fetch({
				crawl: {
					url: "https://example.com/post",
					titleSelector: ".entry-title",
					contentSelector: ".entry-content",
					dateSelector: ".entry-meta time",
					authorSelector: ".author",
				},
			});
			expect(items).toHaveLength(1);
			expect(items[0]?.title).toBe("Hello World");
			expect(items[0]?.content).toContain("Body text here");
			expect(items[0]?.author).toBe("Jane Doe");
			expect(items[0]?.publishedAt?.toISOString()).toBe(
				"2026-08-01T09:00:00.000Z",
			);
		});

		it("falls back to h1/title and article when selectors are absent", async () => {
			mockFetch({
				"https://example.com/post": ARTICLE_HTML("No Selectors", "Just body"),
			});
			const items = await adapter.fetch({
				crawl: { url: "https://example.com/post" },
			});
			expect(items).toHaveLength(1);
			expect(items[0]?.title).toBe("No Selectors");
		});
	});

	describe("item-list mode (itemSelector set)", () => {
		it("finds links, fetches each article page, resolves relative URLs", async () => {
			mockFetch({
				"https://example.com/news": LISTING_HTML,
				"https://example.com/p/one": ARTICLE_HTML("First post", "One body"),
				"https://example.com/p/two": ARTICLE_HTML("Second post", "Two body"),
				"https://example.com/p/three": ARTICLE_HTML("Third post", "Three body"),
			});
			const items = await adapter.fetch({
				crawl: {
					url: "https://example.com/news",
					itemSelector: "article.post",
					linkSelector: ".post-title a",
					titleSelector: ".entry-title",
					contentSelector: ".entry-content",
				},
			});
			expect(items).toHaveLength(3);
			expect(items.map((i) => i.title)).toEqual([
				"First post",
				"Second post",
				"Third post",
			]);
			expect(items[0]?.url).toBe("https://example.com/p/one");
		});

		it("caps the number of fetched pages with maxItems", async () => {
			mockFetch({
				"https://example.com/news": LISTING_HTML,
				"https://example.com/p/one": ARTICLE_HTML("First post", "One body"),
				"https://example.com/p/two": ARTICLE_HTML("Second post", "Two body"),
			});
			const items = await adapter.fetch({
				crawl: {
					url: "https://example.com/news",
					itemSelector: "article.post",
					linkSelector: ".post-title a",
					maxItems: 2,
				},
			});
			expect(items).toHaveLength(2);
		});

		it("returns [] when the listing page fails", async () => {
			mockFetch({});
			const items = await adapter.fetch({
				crawl: {
					url: "https://example.com/news",
					itemSelector: "article.post",
				},
			});
			expect(items).toHaveLength(0);
		});
	});

	describe("parse", () => {
		it("produces a normalized article with a stable hash", async () => {
			const item = {
				title: "T",
				content: "C",
				url: "https://x.com/1",
				publishedAt: new Date("2026-08-01T00:00:00Z"),
			};
			const article = adapter.parse(item, { sourceId: "src-1", hash: "" });
			expect(article.sourceId).toBe("src-1");
			expect(article.title).toBe("T");
			expect(article.hash).toBeTruthy();
			// Same input → same hash (dedup contract).
			const again = adapter.parse(item, { sourceId: "src-1", hash: "" });
			expect(again.hash).toBe(article.hash);
		});
	});
});
