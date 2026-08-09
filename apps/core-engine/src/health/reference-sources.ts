/**
 * Connector reference sources (v1.8.0) — the health-check catalog.
 *
 * Contract: every official adapter has at least ONE verified reference source
 * in this catalog; a connector without a working reference source is not
 * considered production-ready. `scripts/connector-health.mjs` runs each entry
 * against the real network (nightly in CI) and fails loudly when an adapter
 * stops collecting — the alternative is the silent "No new articles found"
 * that hides a dead connector.
 *
 * Reddit is intentionally NOT cataloged. Its public `.json` endpoint is free
 * to reach (only the paid tier requires a key), but Reddit is known to be
 * aggressive toward third-party clients — and a nightly automated probe from
 * datacenter IPs would provoke a company that sells its API. Legal right is
 * not the same as wise to poke: the adapter still ships for users who add a
 * Reddit source; we simply never probe Reddit ourselves.
 *
 * The config objects here must match the adapter's own `validate()` contract
 * (they mirror `configFields` in the plugin manifests). Keep them boring and
 * stable: prefer well-known, long-lived endpoints. When an endpoint becomes
 * unreliable, swap the reference — don't weaken `expectedMin`.
 */

export interface ReferenceSource {
	/** Adapter registry name — matches `SourceAdapter.name`. */
	adapter: string;
	/** Stable id unique across the catalog. */
	id: string;
	/** Human label shown in the health table. */
	name: string;
	/** Config exactly as the adapter's `validate()` expects it. */
	config: Record<string, unknown>;
	/** Minimum healthy items a live fetch must return (adapters skip
	 *  empty-title items internally, so a count is a meaningful signal). */
	expectedMin: number;
	/** Optional per-run time budget in ms — reported either way. */
	maxLatencyMs?: number;
	/**
	 * Known-unreliable from CI-class networks (datacenter IPs): a failed run is
	 * reported as a WARNING, not a failing exit code. The source is still
	 * exercised nightly; flip this off if it stabilizes. Only for sources whose
	 * failure is environmental, not a connector bug — do not use it to mask rot.
	 * (Currently unused: Reddit, the original candidate, is excluded entirely by
	 * policy — see connector-policy.md — so we never probe it at all.)
	 */
	knownFlaky?: boolean;
	/** Why this source was picked / known brittleness. */
	note?: string;
}

export const REFERENCE_SOURCES: ReferenceSource[] = [
	{
		adapter: "rss",
		id: "rss-github-blog",
		name: "GitHub Blog feed",
		config: { feedUrl: "https://github.blog/feed/" },
		expectedMin: 1,
		maxLatencyMs: 15_000,
	},
	{
		adapter: "github-releases",
		id: "gh-vercel-next",
		name: "vercel/next.js releases",
		config: { owner: "vercel", repo: "next.js" },
		expectedMin: 1,
		maxLatencyMs: 15_000,
	},
	{
		adapter: "arxiv",
		id: "arxiv-cs-ai",
		name: "arXiv cat:cs.AI",
		config: { query: "cat:cs.AI" },
		expectedMin: 1,
		maxLatencyMs: 20_000,
	},
	{
		adapter: "html",
		id: "html-hacker-news",
		name: "Hacker News front page",
		config: {
			crawl: {
				url: "https://news.ycombinator.com/",
				itemSelector: ".athing",
				linkSelector: ".titleline a",
				maxItems: 5,
			},
		},
		expectedMin: 1,
		maxLatencyMs: 30_000,
		note: "The most fragile adapter — HN's markup is the canary. Swap the page, not the check, when it breaks.",
	},
	{
		adapter: "sitemap",
		id: "sitemap-github-blog",
		name: "GitHub Blog sitemap",
		config: { sitemap: { sitemapUrl: "https://github.blog/post-sitemap.xml" } },
		expectedMin: 1,
		maxLatencyMs: 30_000,
	},
	{
		adapter: "api",
		id: "api-jsonplaceholder",
		name: "jsonplaceholder posts",
		config: {
			api: {
				apiUrl: "https://jsonplaceholder.typicode.com/posts",
				titleField: "title",
			},
		},
		expectedMin: 1,
		maxLatencyMs: 15_000,
	},
];
