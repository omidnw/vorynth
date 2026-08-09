import type { DocsSection } from "../types.js";

/** Sources — where stories come from, and how long they stay. */
export const sourcesSection: DocsSection = {
	id: "sources",
	title: "Sources",
	summary: "Where stories come from — and how long they stay.",
	icon: "storage",
	pageRoute: "/sources",
	blocks: [
		{
			type: "paragraph",
			text: "Sources are the inputs to Vorynth. Each one has an adapter (RSS, GitHub releases, arXiv…), a name, a URL, a category, and a fetch window. The crawler fetches them on a schedule (every 30 minutes) and on demand.",
		},
		{
			type: "paragraph",
			text: "The Sources page is organised around curated lists. A list is a group of sources with a name, a description, an origin badge, and a master on/off switch. Turning a list off hides its sources from the page and the crawler — nothing is deleted, and turning it back on restores them with every edit you made intact.",
		},
		{
			type: "paragraph",
			text: "You can also browse the same sources grouped by category, country, city, or language. The 'Group by' selector at the top of the page switches between the list structure and grouped cards — each card bundles every source that shares a tag and carries a master switch for the whole group, while each source inside keeps its own toggle, time range, and edit button.",
		},
		{
			type: "features",
			items: [
				{
					icon: "sell",
					label: "Group by Category",
					text: "Groups sources by their category — all Security sources in one card, all AI sources in another, and so on. This is the default view, so the official sources aren't one flat block.",
				},
				{
					icon: "public",
					label: "Group by Country",
					text: "Groups sources by the country they're based in — the card shows the full region name (e.g. 'United States') with the ISO code tag (US).",
				},
				{
					icon: "location_on",
					label: "Group by City",
					text: "Groups sources by city or region. Sources without a location land in an 'Untagged' group.",
				},
				{
					icon: "translate",
					label: "Language badge",
					text: "Every source row shows its language as a small badge (en, es, …) with the full language name on hover — and you can group by Language too.",
				},
				{
					icon: "toggle_on",
					label: "Group master switch",
					text: "Each group card has a master switch: one click enables or disables every source in the group at once. It's a bulk toggle — individual sources can still be flipped afterwards.",
				},
				{
					icon: "edit",
					label: "Country / City / Language tags",
					text: "The Add and Edit source forms have optional Country, City, and Language fields. Set them when you create a source, or correct any source's tags any time — that's what the group-by views are built on.",
				},
			],
		},
		{
			type: "paragraph",
			text: "Every source also carries optional semantic metadata — three short labels that describe what kind of source it is, beyond its feed: Scope (how broadly its subject matters), Authority (how credible it is), and Impact areas (what fields it touches). They're optional: leave them unset and the source just works; set them and the source row shows an Authority badge. Today these labels are stored and editable — Vorynth's intelligence layer will reason over them later, so a source is never just 'a URL to crawl'.",
		},
		{
			type: "features",
			items: [
				{
					icon: "public",
					label: "Scope",
					text: "How broadly does this source matter? Global means it affects everyone (Cloudflare's blog, AWS news), Local means city-level, and Community is for niche but devoted audiences.",
				},
				{
					icon: "verified_user",
					label: "Authority",
					text: "How credible is it? Official = the organization itself (OpenAI Blog), Research = papers, Media = journalism, Community = forums, Personal = an individual's blog. The source row shows a small Authority badge (official, media, personal, …) with an explanation on hover.",
				},
				{
					icon: "sell",
					label: "Impact areas",
					text: "What fields this source touches — lowercase slugs like ai, security, cloud. The Add/Edit form offers a suggested vocabulary you can tap to add, or you can type your own comma-separated list.",
				},
				{
					icon: "file_download",
					label: "Share your sources (my-sources.json)",
					text: "My sources can be exported as my-sources.json — pick a few sources, choose Export as list, name it, and the file downloads. It's the same format as Vorynth's community source lists, so it can be imported on any device (Import list), shared with anyone, or dropped into the Vorynth GitHub repo under sources/<curator>/ to become a community list others can browse.",
				},
			],
		},
		{
			type: "features",
			items: [
				{
					icon: "verified",
					label: "Official vs Community",
					text: "Official lists ship inside Vorynth and are trusted. Community lists are contributed through the Vorynth GitHub repo, downloaded once, and cached — they keep working offline.",
				},
				{
					icon: "toggle_on",
					label: "Master switch",
					text: "Each list has an on/off switch. Off hides the whole list (sources keep their individual settings).",
				},
				{
					icon: "18_up_rating",
					label: "18+ lists",
					text: "Lists flagged 18+ show a badge. They're hidden from browsing by default (Settings → Hide adult lists) and enabling one asks for confirmation.",
				},
				{
					icon: "search",
					label: "Search",
					text: "The search box filters sources by name, URL, or category — and filters the list cards too.",
				},
				{
					icon: "edit",
					label: "Edit a source",
					text: "Every source has an Edit button. The form opens pre-filled with the source's name, category, and configuration fields — change what you need and save. The URL and time range are managed on the row itself.",
				},
				{
					icon: "person",
					label: "My sources",
					text: "Sources you create yourself belong to 'My sources' and aren't part of any list. They're the only ones that can be deleted — a source inside a list is owned by the list (hide the list instead).",
				},
			],
		},
		{
			type: "flow",
			title: "How a community list reaches your app",
			steps: [
				{ icon: "cloud_sync", label: "Check GitHub for lists" },
				{ icon: "cloud_download", label: "Download + validate" },
				{ icon: "offline_pin", label: "Cached offline" },
				{ icon: "add", label: "Add list (opt-in)" },
			],
		},
		{
			type: "bullets",
			items: [
				"Lists are shared as JSON files in the Vorynth GitHub repo (sources/ folder, flat files or per-author folders). 'Check GitHub for lists' downloads the catalog; it also refreshes automatically once a day.",
				"Every downloaded list is validated before it's stored — a list whose sources reference unknown adapters or invalid configurations is skipped, never saved.",
				"Downloaded lists work offline. A failed check never deletes what you already have — your saved lists are unchanged.",
				"Sources inside a list are never deleted individually. To stop a list, switch it off — you can add it back any time.",
			],
		},
		{
			type: "features",
			items: [
				{
					icon: "toggle_on",
					label: "Enable / disable",
					text: "Disabled sources are skipped by the crawler.",
				},
				{
					icon: "schedule",
					label: "Time range",
					text: "How much of a source to keep — Last 24h, Last week, Last month, Last year, Unlimited, or Custom. Custom is your choice: a relative window (N days) or an absolute date range (from date to date). Retention prunes articles outside the range, so a window that predates retention honestly explains they're gone.",
				},
				{
					icon: "article",
					label: "Articles view",
					text: "The article icon next to each source's controls opens a list of what that source published within its current time range — exactly what the crawler keeps. Each row opens the full article. Lists longer than 10 items get a 'Show more' button. Hover the icon for a short explanation.",
				},
				{
					icon: "auto_stories",
					label: "Full article text",
					text: "Feeds often only publish a short description per item. When a story arrives with just a snippet (or nothing), the crawler fetches the article's own page and extracts the full body — so stories carry the complete text. If the page can't be read, the feed's snippet is kept.",
				},
				{
					icon: "delete",
					label: "Delete",
					text: "Removes the source and its stories — with a confirmation that warns how many saved stories are affected.",
				},
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
				{ icon: "location_on", label: "Country / City / Language" },
				{ icon: "check", label: "Add" },
			],
		},
		{
			type: "paragraph",
			text: "Every source collects with one method — the method tells Vorynth how to turn a URL into stories. Pick a method and the form shows its configuration fields; you can Test a configuration before saving. Here is what each method does, and an example URL to try:",
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
					text: "Structured data endpoints (JSON) instead of feeds — the JSON API adapter requests the endpoint and maps each record into a story using the field names you provide (title, content, URL, date, author). An optional Items path points at the records array, and headers let you reach keyed endpoints. GitHub releases ship as a dedicated core adapter. Example: https://api.example.com/v1/posts",
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
					text: "Pages with no feed at all — the HTML crawler reads a page's markup using CSS selectors. Give it an item selector + link selector on a listing page, and it follows each link and extracts the story with your title/content/date/author selectors. Leave the item selector empty to treat the URL as a single article page. Example: a blog's homepage URL when it has no /feed.",
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
				"Vorynth's collection pipeline is adapter-based: each method is handled by an adapter plugin. RSS, GitHub releases, Sitemap, and JSON API carry the Core badge (arXiv is an Official connector — built and live-tested by Vorynth); every adapter can be switched off on the Plugins page, and its sources pause (keeping their own state) until you re-enable it.",
				"Each method has its own icon — RSS, GitHub, arXiv, the crawler, Sitemap, the JSON API, and Reddit — shown on the method buttons in the Add Source form, in the sources list, and on the Plugins page.",
				"Each method's configuration fields are generated from its plugin's schema — pick a method and the Add Source form shows exactly the fields that method needs.",
				"The 'Test' button dry-runs a configuration without saving: it fetches a few items and shows you what the adapter would collect, so you can check your selectors or field names before you commit.",
			],
		},
		{
			type: "paragraph",
			text: "To add an RSS source: find the feed URL of a blog or news site (usually ends in /rss, /feed, /rss.xml, or /feed.xml — look for the RSS icon on the site). Click 'Add Source', pick a name, paste the URL, choose the RSS method, pick or type a category, and click Add. Vorynth will fetch it on the next collection run.",
		},
		{
			type: "features",
			items: [
				{
					icon: "rss_feed",
					label: "Rust Blog",
					text: "https://blog.rust-lang.org/feed.xml — Programming Languages",
				},
				{
					icon: "rss_feed",
					label: "Krebs on Security",
					text: "https://krebsonsecurity.com/feed/ — Security",
				},
				{
					icon: "rss_feed",
					label: "OpenAI Blog",
					text: "https://openai.com/blog/rss.xml — AI",
				},
				{
					icon: "rss_feed",
					label: "The GitHub Blog",
					text: "https://github.blog/feed/ — Software Engineering",
				},
			],
		},
		{
			type: "bullets",
			items: [
				"The method you pick decides how Vorynth interprets the URL — RSS for feeds, HTML for pages, Sitemap for sitemap.xml, API for structured endpoints. Each method is an adapter plugin you can enable or disable on the Plugins page.",
				"You can type any category you like (e.g. 'robotics', 'quantum') — Vorynth stores it as-is and uses it for ranking and filtering.",
				"Use Test before adding a source that needs configuration (HTML selectors, API fields) — it fetches a few items so you can confirm the adapter reads the page the way you expect.",
				"New sources are collected on the next run (every 30 minutes) or instantly when you press Collect. When a collect run pulls in new stories and an AI provider is configured, Vorynth automatically translates them into your intelligence language; in News mode (no API key) nothing is queued.",
			],
		},
	],
};
