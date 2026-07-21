/**
 * Changelog data — static, ships with the bundle.
 *
 * To add a new release: prepend a new `Release` object to the `RELEASES`
 * array. Version codenames draw from the Vorynth brand language
 * (project-details.md §9: Signal Over Noise, Source Quality Over Quantity,
 * Explain Don't Just Summarize, Privacy First).
 */

import { VORYNTH_VERSION } from "@vorynth/types";

/**
 * Current release version — always syncs with the shared constant so the
 * Settings page and the Changelog header never drift.
 */
export const CURRENT_VERSION = VORYNTH_VERSION;

export type ChangeType = "new" | "improved" | "fixed" | "security";

export interface ChangeEntry {
	type: ChangeType;
	text: string;
}

export interface Release {
	version: string;
	codename: string;
	date: string;
	summary: string;
	changes: ChangeEntry[];
}

export const RELEASES: Release[] = [
	{
		version: "1.4.0",
		codename: "Local Engine",
		date: "2026-07-22",
		summary:
			"Vorynth is now a proper desktop app that works out of the box. The core engine is bundled as a Tauri sidecar — no Node install needed. On first launch, the database is automatically created and migrated, and 13 high-quality sources are seeded and collected immediately. The app also came home with a new logo, live favicon, and a fresh landing page.",
		changes: [
			{
				type: "new",
				text: "13 seed sources (OpenAI, Hugging Face, GitHub Blog, Martin Fowler, web.dev, Cloudflare, HashiCorp, AWS, Krebs, Cloudflare Security, OpenSSF, Rust, Python) are auto-seeded on first launch — zero-configuration news reading from day one.",
			},
			{
				type: "fixed",
				text: "Core engine is now bundled as a Tauri resource so the .app works without a separate Node.js installation. The sidecar directory is discovered at Runtime/Resources/ on macOS.",
			},
			{
				type: "fixed",
				text: "Database auto-migrates on every startup — the first run creates all tables, FTS5 index, and seeds defaults. No more pnpm db:migrate required.",
			},
			{
				type: "fixed",
				text: "Application data lives in a persistent platform-appropriate directory (e.g. ~/Library/Application Support/com.vorynth.desktop/ on macOS) so the SQLite database survives app reinstalls and is user-accessible.",
			},
			{
				type: "fixed",
				text: "CORS now accepts any origin — the Tauri webview was sending requests from a custom protocol (tauri://) that the restrictive localhost-only policy blocked, making the frontend unable to reach the engine despite both running on the same machine.",
			},
			{
				type: "fixed",
				text: "Frontend and engine now agree on a fixed port (34117) by default — no init-script communication needed. A URL query-parameter fallback covers the rare case where the fixed port is already in use.",
			},
			{
				type: "fixed",
				text: "Better-sqlite3 native addon is now properly bundled in the sidecar. The previous configuration externalised it, leaving an unresolved import in the ESM bundle.",
			},
			{
				type: "improved",
				text: "New Vorynth logo (square, transparent) replaces the dark-background placeholder. Favicon supports ico, icns, and PNG at all standard sizes.",
			},
			{
				type: "improved",
				text: "Landing page at omidnw.github.io/vorynth/ redesigned with Material Symbols, scroll animations, Inter font, and a Google Translate widget supporting 14 languages.",
			},
		],
	},
	{
		version: "1.3.0",
		codename: "In Your Language",
		date: "2026-07-21",
		summary:
			"Vorynth now speaks two languages: the app UI language and the AI output language are independent settings on your Profile. Set the app language in any script (export/import the English catalog), and separately choose the language for Ask-AI answers, generated briefs, and period summaries — powered by the ISO 639-1 standard. AI-generated content now renders with automatic direction detection: Persian, Arabic, and Hebrew flow right-to-left while English stays left-to-right, even on the same page. The hand-rolled language list was replaced with the standard iso-639-1 package, and a new project skill codifies the principle: prefer well-maintained standard packages over custom code.",
		changes: [
			{
				type: "new",
				text: "AI Output Language setting on your Profile — choose from all 183 ISO 639-1 languages. Ask-AI search, generated briefs, period summaries, and behavior summaries all respond in your preferred language. Backend reads the preference automatically, no configuration needed.",
			},
			{
				type: "new",
				text: "App UI language is now synced to your profile. Change it once on the Profile page and it persists across restarts — no need to re-import translations.",
			},
			{
				type: "improved",
				text: 'Right-to-left auto-detection everywhere — article body, AI answers, insights, summaries, search results, and history pages all use dir="auto" so the browser detects text direction by the first strong character. Persian, Arabic, and Hebrew read naturally while mixed English content stays left-to-right on the same page.',
			},
		],
	},
	{
		version: "1.2.0",
		codename: "Richer Briefing, Smarter Search",
		date: "2026-07-21",
		summary:
			"Every part of the history experience was rebuilt. The History drawer now opens search and briefing details as full, beautiful dedicated pages with floating action footers. Period summaries are dramatically richer — the engine asks for 4–6 distinct takeaways, 2–3 recommended actions, and 5–6 semantic themes with rationale instead of the previous hardcoded cap of 2 takeaways and 1 action. The Search page was redesigned with a modern Google-like hero, animated mode toggle, citation previews, and 'View full result' buttons that deep-link to the new detail pages. Source links that had gone missing from insights and brief items are restored. The version string is now defined in a single place (@vorynth/types) so Settings, Changelog, and the engine's /status endpoint stay in sync.",
		changes: [
			{
				type: "new",
				text: "Dedicated history detail pages — clicking a search, briefing, or generated entry opens a full-page view at /history/search/:id, /history/brief/:id, or /history/generated/:id instead of a cramped in-drawer preview. Each page has its own back navigation, metadata badges, the full cached result, and a floating footer with primary actions (Re-search / Regenerate / Copy).",
			},
			{
				type: "improved",
				text: "Period summaries now produce 4–6 takeaways, 2–3 recommended actions, and up to 6 LLM-generated themes with a one-sentence rationale explaining each through-line. The previous architectural bottleneck routed the summarize call through the per-article analyze path which capped output at 2 takeaways and 1 action regardless of story volume.",
			},
			{
				type: "improved",
				text: "Search page redesigned with a Google-inspired hero layout: larger rounded search bar, animated pill mode toggle (Keyword / Ask AI) with a sliding primary indicator, featured answer card with 6-line preview + expand, citation chips for the first 3 sources, refined keyword hit cards with score badges and Read / Read source links, and 'View full result' buttons that deep-link to the history detail page.",
			},
			{
				type: "new",
				text: "Period Summary panel on the Brief page now shows a preview (headline + theme chips + first 3 takeaways) plus a 'View full brief' button that opens the dedicated detail page.",
			},
			{
				type: "fixed",
				text: "Source links (Read original article) restored on both the Brief list and the Insight detail page. The previous 'Understand Before You Read' refactor had routed click-throughs to the internal reader or insight view without carrying the original article URL — insight-generated entries had no source link at all.",
			},
			{
				type: "fixed",
				text: "Engine /status endpoint was returning a hardcoded '1.0.2' that had drifted from the actual release. Version is now defined once in @vorynth/types and consumed by every surface (Settings, Changelog, engine status).",
			},
			{
				type: "improved",
				text: "Sidebar cleaned up: the 'Generate Brief' button is removed because the Brief page already has equivalent controls, keeping the navigation lean.",
			},
		],
	},
	{
		version: "1.1.0",
		codename: "Understand Before You Read",
		date: "2026-07-20",
		summary:
			"A personalization + reader release. Vorynth now knows the reader — a Profile page holds your identity, a custom instruction that biases Ask-AI, and an AI-generated behavior summary built from your history. A native article reader shows the full body and media, with a nudge to support the original author. Media is never stored unless you decide, per item, to keep it locally.",
		changes: [
			{
				type: "new",
				text: "Native article reader — clicking any story now opens a focused in-app view with the full body text, source, author, and date, instead of bouncing you out to the source site. The reader carries a clear 'read original' link in the header and footer.",
			},
			{
				type: "new",
				text: "'Support the author' reminder — before the reader opens, a modal explains that the story's canonical home is the site that published it (where the author gets credit and views) and offers to open the original. Dismissable forever with a checkbox; re-enabled from Profile → Reader settings.",
			},
			{
				type: "new",
				text: "Profile page — your identity (first/last name, alias, avatar), a custom instruction that biases how the AI responds to you, an AI-generated behavior summary, and read-only interests derived from your history. The sidebar's 'Local User' avatar now opens it and shows your name.",
			},
			{
				type: "new",
				text: "Custom instruction — a free-form directive (tone, depth, what to emphasize or avoid) that's prepended to every Ask-AI search and generate call, so responses are shaped by what the app knows about you. An 'Improve' button rewrites your rough draft into a crisp professional version, with a side-by-side preview before you apply it.",
			},
			{
				type: "new",
				text: "Behavior summary — one click generates a short, neutral profile of how you use Vorynth (what you search, which topics dominate, keyword vs. AI split) computed from your search and briefing history. Each generation is saved to a new 'Generated' history scope so it's revisitable.",
			},
			{
				type: "new",
				text: "Media control — images and video for an article are fetched on-demand from the original source, never cached. A keep icon on each item lets you opt to store it locally for offline reading; a 'Media' page in the sidebar lists everything you've kept with per-article sizes and a purge-all control. Nothing leaves the source without your explicit per-item choice.",
			},
			{
				type: "new",
				text: "Generated history scope — the History drawer gains a third tab (alongside Search and Briefings) reachable on the Profile page. Every behavior summary and instruction-improvement is recorded there, with rename/archive/delete and a regenerate deep-link back to Profile.",
			},
			{
				type: "improved",
				text: "Language settings moved from Settings to Profile, alongside identity and personalization — so everything about 'how Vorynth speaks to you' lives in one place. Settings points to the new location.",
			},
		],
	},
	{
		version: "1.0.2",
		codename: "Source Quality Over Quantity",
		date: "2026-07-20",
		summary:
			"A provenance + memory release. Multi-source citations in period summaries now resolve correctly, and every search and briefing is remembered — open the History drawer from the header to revisit, rename, archive, or delete past work.",
		changes: [
			{
				type: "fixed",
				text: "Citations in period summaries were silently dropped. The model emits multi-source markers like [1,3,5], but the parser only matched single [N] — so hovering a number showed nothing and the Sources list stayed empty. Both the backend and frontend parsers now handle comma-form markers; each number in [1,3,5] becomes its own hoverable chip with a source tooltip and click-to-open. The summary prompt was updated to ask for comma-form explicitly.",
			},
			{
				type: "new",
				text: "History drawer — a right-side panel opened from the header. It follows the page you're on: search history on /search, briefing history on /brief. The dynamic title (Search History / Briefing History) makes it obvious which one you're looking at, so there's no toggle to get wrong. Survives route changes and navigation.",
			},
			{
				type: "new",
				text: "Persistent search + briefing history. Every Ask-AI answer is saved by default (it cost tokens, so it's worth revisiting); keyword-search recording is opt-in. Past briefings are stored the moment they're generated — previously they were regenerated and discarded each time, so last week's summary was unreachable. Both are now durable across restarts.",
			},
			{
				type: "new",
				text: "Entry management — every history row can be renamed, archived, or deleted via its more-menu. Multi-select mode adds checkboxes and a bulk Archive / Delete bar. Archived entries are hidden from the default list but recoverable with includeArchived. Detail view renders the cached result (Ask-AI answer + cited sources, or the full period briefing) with a Re-search / Re-ask deep-link back to the Search page.",
			},
			{
				type: "new",
				text: "Settings → History section with two toggles bound to the engine: Save Ask AI searches (on by default) and Save keyword searches (off by default). Preferences persist in the new app_settings table.",
			},
			{
				type: "improved",
				text: "Period summaries now auto-record to brief history on generation, with period bounds and story count, so every briefing is addressable from the History drawer without regenerating.",
			},
		],
	},
	{
		version: "1.0.1",
		codename: "Explain Don't Just Summarize",
		date: "2026-07-20",
		summary:
			"A visibility fix. The Settings usage panel was reading zero for every call — now every request, token, and failure is actually recorded and surfaced.",
		changes: [
			{
				type: "fixed",
				text: "Usage tracking now records every LLM call. The previous insert was fire-and-forget, which Drizzle's lazy executor never ran — so the panel reported 0 requests and 0 tokens no matter how much you used. Inserts are now awaited and any failure is logged instead of swallowed.",
			},
		],
	},
	{
		version: "1.0.0",
		codename: "Signal Over Noise",
		date: "2026-07-19",
		summary:
			"The first release of Vorynth — a local-first personal intelligence engine that turns the flood of global information into a short, ranked brief.",
		changes: [
			{
				type: "new",
				text: "News-first design — Vorynth works the moment you open it. Collect from 13 sources across all domains with zero configuration, no API key required.",
			},
			{
				type: "new",
				text: "LangGraph intelligence workflow (Collector → Normalizer → Ranker → Analyzer → Localizer) with per-article Why-it-matters / Impact / Recommended-Action triad.",
			},
			{
				type: "new",
				text: "Four LLM providers: Gemini, OpenAI, Anthropic, and Ollama (local). API keys encrypted at rest with AES-256-GCM, machine-bound.",
			},
			{
				type: "new",
				text: "Rate-limited LLM worker (5 req/min) with a global job queue so your API key never hits RPM limits. Live progress shown across all pages.",
			},
			{
				type: "new",
				text: "Background jobs — Collect, Generate, Summarize, and Ask AI all run server-side. Navigate away freely; work continues. Floating JobsTray + top-bar indicator.",
			},
			{
				type: "new",
				text: "Search — keyword (multi-word, SQL LIKE) and Ask AI (RAG with 24K token context budget, well under 200K window). Inline citations with hover tooltips + click-to-source.",
			},
			{
				type: "new",
				text: "Period summaries — generate one cohesive briefing over today / this week / this month with numbered citations to source stories.",
			},
			{
				type: "new",
				text: "Per-source fetch window (default 7 days, user-overridable per source). The crawler prunes old articles to keep the DB tidy.",
			},
			{
				type: "new",
				text: "Sort modes on the Brief: Newest, Most relevant, Most important. Domain filter chips. Live-refresh while collecting.",
			},
			{
				type: "new",
				text: "13 RSS sources seeded across AI, Software Engineering, Security, Cloud, Backend, DevOps, Open Source, and Programming Languages. GitHub releases + arXiv adapters included.",
			},
			{
				type: "new",
				text: "Backup / restore / delete-all — export `.vorynth-backup` snapshots, restore from any backup, or permanently wipe all local data.",
			},
			{
				type: "new",
				text: "i18n + RTL support — ships in English; user exports the catalog, translates it, and imports it back. RTL languages (Arabic, Persian, Hebrew) lay out automatically.",
			},
			{
				type: "new",
				text: "Light (Precision Minimalism) and Dark (Obsidian Intelligence) themes from day one. Forest & Slate palette. Newsreader + Geist typography.",
			},
			{
				type: "new",
				text: "Tauri desktop shell with NestJS sidecar lifecycle — picks a free port, spawns the engine, polls `/health`, injects the port into the webview, and terminates on close.",
			},
			{
				type: "new",
				text: "Usage tracking — token + request spend persisted per operation and provider, surfaced in Settings with a reset button.",
			},
			{
				type: "new",
				text: "Scheduled auto-collect (every 30 min) and daily report generation. Both overridable via environment variables.",
			},
			{
				type: "improved",
				text: "Precision Minimalism design system — tonal segmentation instead of shadows, 4px base radius, no decorative color, Material Symbols icons.",
			},
			{
				type: "security",
				text: "Local-first architecture — sources, articles, reading history, and API keys stay on the user's device. Nothing leaves except direct provider API calls.",
			},
		],
	},
];
