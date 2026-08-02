import type { DocsSection } from "../types.js";

/** Sources — where stories come from, and how long they stay. */
export const sourcesSection: DocsSection = {
	id: "sources",
	title: "Sources",
	summary: "Where stories come from — and how long they stay.",
	icon: "database",
	pageRoute: "/sources",
	blocks: [
		{
			type: "paragraph",
			text: "Sources are the inputs to Vorynth. Each one has an adapter (RSS, GitHub releases, arXiv…), a name, a URL, a category, and a fetch window. The crawler fetches them on a schedule (every 30 minutes) and on demand.",
		},
		{
			type: "features",
			items: [
				{ icon: "toggle_on", label: "Enable / disable", text: "Disabled sources are skipped by the crawler." },
				{ icon: "schedule", label: "Time range", text: "How much of a source to keep — Last 24h, Last week, Last month, Last year, Unlimited, or Custom. Custom is your choice: a relative window (N days) or an absolute date range (from date to date). Retention prunes articles outside the range, so a window that predates retention honestly explains they're gone." },
				{ icon: "article", label: "Articles view", text: "The article icon next to each source's controls opens a list of what that source published within its current time range — exactly what the crawler keeps. Each row opens the full article. Lists longer than 10 items get a 'Show more' button. Hover the icon for a short explanation." },
				{ icon: "delete", label: "Delete", text: "Removes the source and its stories — with a confirmation that warns how many saved stories are affected." },
			],
		},
		{
			type: "paragraph",
			text: "Categories are how Vorynth groups sources for ranking and filtering. The built-in categories cover the most common technical domains: AI, Security, Cloud, Backend, DevOps, Software Engineering, Web Development, Programming Languages, Open Source, and Other. You can also type a custom category (e.g. 'robotics', 'quantum', 'hardware') — the engine stores any value you choose.",
		},
		{
			type: "flow",
			title: "Add a source",
			steps: [
				{ icon: "add", label: "Add Source" },
				{ icon: "edit", label: "Name + URL" },
				{ icon: "rss_feed", label: "Pick method" },
				{ icon: "label", label: "Pick category" },
				{ icon: "check", label: "Add" },
			],
		},
		{
			type: "paragraph",
			text: "Every source collects with one method — the method tells Vorynth how to turn a URL into stories. Here is what each of the four methods does, and an example URL to try:",
		},
		{
			type: "features",
			id: "sources-method-rss",
			items: [
				{
					icon: "rss_feed",
					label: "RSS",
					text: "Web feeds — the standard way sites publish new stories. Vorynth fetches the feed URL on its schedule, parses every entry into a story (title, content, date, author), and dedupes repeats. Example: https://blog.rust-lang.org/feed.xml",
				},
			],
		},
		{
			type: "features",
			id: "sources-method-api",
			items: [
				{
					icon: "api",
					label: "API",
					text: "Structured data endpoints (JSON) instead of feeds — an API adapter requests the endpoint and maps each record into a story. GitHub releases already ship as a dedicated adapter, so a repository's release notes land as stories. Example: github.com/{owner}/{repo}/releases",
				},
			],
		},
		{
			type: "features",
			id: "sources-method-html",
			items: [
				{
					icon: "html",
					label: "HTML",
					text: "Pages with no feed at all — the HTML adapter reads the page's markup and extracts the stories from it. Example: a blog's homepage URL when it has no /feed.",
				},
			],
		},
		{
			type: "features",
			id: "sources-method-sitemap",
			items: [
				{
					icon: "map",
					label: "Sitemap",
					text: "Sites that publish a sitemap.xml — Vorynth reads the URL list from the sitemap, then fetches each listed page as a story. Example: https://example.com/sitemap.xml",
				},
			],
		},
		{
			type: "bullets",
			id: "sources-methods-note",
			items: [
				"Vorynth's collection pipeline is adapter-based: each method is handled by a registered adapter. Today the Add Source form wires every method through the RSS adapter — GitHub releases and arXiv have dedicated adapters bundled, and the HTML, API, and Sitemap adapters register as they ship (a one-line registration, no core changes).",
			],
		},
		{
			type: "paragraph",
			text: "To add an RSS source: find the feed URL of a blog or news site (usually ends in /rss, /feed, /rss.xml, or /feed.xml — look for the RSS icon on the site). Click 'Add Source', pick a name, paste the URL, choose the RSS method, pick or type a category, and click Add. Vorynth will fetch it on the next collection run.",
		},
		{
			type: "features",
			items: [
				{ icon: "rss_feed", label: "Rust Blog", text: "https://blog.rust-lang.org/feed.xml — Programming Languages" },
				{ icon: "rss_feed", label: "Krebs on Security", text: "https://krebsonsecurity.com/feed/ — Security" },
				{ icon: "rss_feed", label: "OpenAI Blog", text: "https://openai.com/blog/rss.xml — AI" },
				{ icon: "rss_feed", label: "The GitHub Blog", text: "https://github.blog/feed/ — Software Engineering" },
			],
		},
		{
			type: "bullets",
			items: [
				"The method you pick decides how Vorynth interprets the URL — RSS for feeds, HTML for pages, Sitemap for sitemap.xml, API for structured endpoints.",
				"You can type any category you like (e.g. 'robotics', 'quantum') — Vorynth stores it as-is and uses it for ranking and filtering.",
				"New sources are collected on the next run (every 30 minutes) or instantly when you press Collect.",
			],
		},
	],
};
