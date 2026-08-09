import { SitemapAdapter } from "../../src/modules/crawler/adapters/sitemap-adapter.js";

/** Offline tests for the sitemap adapter — mocked fetch fixtures only. */

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/a</loc><lastmod>2026-08-01</lastmod></url>
  <url><loc>https://example.com/b</loc></url>
  <url><loc>https://example.com/c</loc></url>
</urlset>`;

const PAGE_HTML = (
	title: string,
	body: string,
) => `<!doctype html><html><head><title>${title}</title></head><body>
  <article><h1>${title}</h1><p>${body}</p></article>
</body></html>`;

function mockFetch(routes: Record<string, string>): void {
	globalThis.fetch = jest.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		const hit = routes[url];
		if (hit === undefined) return new Response("not found", { status: 404 });
		return new Response(hit, { status: 200 });
	}) as unknown as typeof fetch;
}

describe("SitemapAdapter", () => {
	let adapter: SitemapAdapter;
	beforeEach(() => {
		adapter = new SitemapAdapter();
	});

	describe("validate", () => {
		it("accepts a valid sitemapUrl", () => {
			expect(
				adapter.validate({
					sitemap: { sitemapUrl: "https://example.com/sitemap.xml" },
				}),
			).toBe(true);
		});
		it("rejects missing/non-http sitemapUrl", () => {
			expect(adapter.validate({})).toBe(false);
			expect(adapter.validate({ sitemap: { sitemapUrl: "nope" } })).toBe(false);
		});
	});

	describe("fetch", () => {
		it("parses <loc> URLs and extracts each page as a story", async () => {
			mockFetch({
				"https://example.com/sitemap.xml": SITEMAP_XML,
				"https://example.com/a": PAGE_HTML("Page A", "Body A"),
				"https://example.com/b": PAGE_HTML("Page B", "Body B"),
				"https://example.com/c": PAGE_HTML("Page C", "Body C"),
			});
			const items = await adapter.fetch({
				sitemap: { sitemapUrl: "https://example.com/sitemap.xml" },
			});
			expect(items).toHaveLength(3);
			expect(items.map((i) => i.url)).toEqual([
				"https://example.com/a",
				"https://example.com/b",
				"https://example.com/c",
			]);
			expect(items[0]?.title).toBe("Page A");
		});

		it("skips pages that fail to fetch", async () => {
			mockFetch({
				"https://example.com/sitemap.xml": SITEMAP_XML,
				"https://example.com/a": PAGE_HTML("Page A", "Body A"),
				// b and c 404 → skipped
			});
			const items = await adapter.fetch({
				sitemap: { sitemapUrl: "https://example.com/sitemap.xml" },
			});
			expect(items).toHaveLength(1);
			expect(items[0]?.title).toBe("Page A");
		});

		it("returns [] when the sitemap itself fails", async () => {
			mockFetch({});
			const items = await adapter.fetch({
				sitemap: { sitemapUrl: "https://example.com/sitemap.xml" },
			});
			expect(items).toHaveLength(0);
		});
	});
});
