import { REFERENCE_SOURCES } from "../../src/health/reference-sources.js";
import { RssAdapter } from "../../src/modules/crawler/adapters/rss-adapter.js";
import { GithubReleasesAdapter } from "../../src/modules/crawler/adapters/github-releases-adapter.js";
import { ArxivAdapter } from "../../src/modules/crawler/adapters/arxiv-adapter.js";
import { HtmlAdapter } from "../../src/modules/crawler/adapters/html-adapter.js";
import { SitemapAdapter } from "../../src/modules/crawler/adapters/sitemap-adapter.js";
import { ApiAdapter } from "../../src/modules/crawler/adapters/api-adapter.js";

/**
 * Reference-source catalog tests (v1.8.0) — OFFLINE ONLY (no network, per
 * /testing-backend). They prove the catalog is well-formed: every cataloged
 * adapter is covered exactly once with unique ids, and every reference config
 * passes its adapter's `validate()`. The LIVE collection contract is proven
 * nightly by scripts/connector-health.mjs in CI — not here.
 *
 * Reddit is deliberately absent from the catalog (never probe Reddit from our
 * own infra — see reference-sources.ts), so it is not expected here either.
 */
describe("Connector health — reference source catalog (v1.8.0)", () => {
	const ADAPTERS = {
		rss: new RssAdapter(),
		"github-releases": new GithubReleasesAdapter(),
		arxiv: new ArxivAdapter(),
		html: new HtmlAdapter(),
		sitemap: new SitemapAdapter(),
		api: new ApiAdapter(),
	};

	it("covers every cataloged adapter exactly once, with unique ids", () => {
		const adapters = REFERENCE_SOURCES.map((r) => r.adapter).sort();
		expect(adapters).toEqual([
			"api",
			"arxiv",
			"github-releases",
			"html",
			"rss",
			"sitemap",
		]);
		const ids = REFERENCE_SOURCES.map((r) => r.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("every reference config passes its adapter's validate() (offline)", () => {
		for (const ref of REFERENCE_SOURCES) {
			const adapter = ADAPTERS[ref.adapter];
			expect(adapter).toBeDefined();
			expect(adapter.validate(ref.config)).toBe(true);
		}
	});

	it("every reference expects at least one item", () => {
		for (const ref of REFERENCE_SOURCES) {
			expect(ref.expectedMin).toBeGreaterThan(0);
		}
	});
});
