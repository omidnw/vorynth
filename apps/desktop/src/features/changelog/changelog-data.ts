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
	/** User-facing change list (what a regular reader experiences). */
	changes: ChangeEntry[];
	/**
	 * Technical change list (v1.6.0) — hidden behind the "Technical details"
	 * toggle on the Changelog page for engineers. Optional for older releases.
	 */
	technical?: ChangeEntry[];
}

export const RELEASES: Release[] = [
	{
		version: "1.8.1",
		codename: "Open The Engine",
		date: "2026-08-10",
		summary:
			"Vorynth opens to developers. The local engine's network access is now yours to control: a Developer section in Settings shows the backend and frontend URLs and decides who may call the engine — local-only by default, open to every device on the network (0.0.0.0), or a custom list of IPs allowed alongside 127.0.0.1. Providers get more room too: OpenAI can point at any OpenAI-compatible endpoint, and Ollama now runs in two modes — local and Ollama Cloud with an API key. Onboarding stops second-guessing your sources choice, curated lists report their real size (no more '0 sources' right after fetching them from GitHub), and you can preview exactly which sites a list contains before enabling it.",
		changes: [
			{
				type: "new",
				text: "Developer settings (Settings → Advanced → Developer) — see the backend and frontend URLs and control who can reach the local engine: local-only by default, open to the whole network (0.0.0.0), or a custom list of IPs allowed alongside 127.0.0.1. CORS and IP rules apply immediately; the listening address applies on the next start.",
			},
			{
				type: "new",
				text: "Ollama Cloud — Ollama now runs in two modes: local (your own server, no key) and cloud (Ollama's hosted models, with an API key from ollama.com/settings/keys).",
			},
			{
				type: "new",
				text: "OpenAI base URL — point the OpenAI provider at any OpenAI-compatible endpoint (self-hosted gateways, compatible APIs). Leave it empty to use the official OpenAI API.",
			},
			{
				type: "new",
				text: "Sources preview — see exactly which sites a curated list contains before enabling it, from the Sources page and from onboarding (View official sources).",
			},
			{
				type: "fixed",
				text: "Onboarding no longer second-guesses your sources choice — turning off the official sources never re-asks, and pressing Continue with no topics keeps them by default instead of getting stuck on the step.",
			},
			{
				type: "fixed",
				text: "Curated lists no longer show '0 sources' right after being fetched from GitHub — a downloaded-but-not-yet-enabled list now reports the sites it actually contains.",
			},
			{
				type: "new",
				text: "Every story knows its view — an Insight/Article chip on each brief card and in the reader, so you're never lost between the analysis and the article.",
			},
			{
				type: "new",
				text: "A default view for your stories (Auto / Article / Insights) on the Brief page — in Insights mode, new stories get their AI analysis automatically (Intelligence mode only).",
			},
			{
				type: "new",
				text: "The Archive sub-pages now live in an expandable sidebar menu (Items · Collections · Bookmarks · Search · Trash · Media). Prefer the old in-page tabs? Switch back in Settings → General → Navigation.",
			},
			{
				type: "new",
				text: "Docs are searchable — type in the Documentation page to find sections by title or text.",
			},
			{
				type: "new",
				text: "Header buttons gained text labels (History, theme, Notifications) and bigger icons — turn the labels off in Settings → Appearance for a compact header.",
			},
			{
				type: "new",
				text: "The history drawer now offers every surface at once (Searches · Briefings · Generated · Viewed), with a filter box — and the search page carries its own history button. Searches that aren't in history are explained with a dismissible tip.",
			},
			{
				type: "fixed",
				text: "Mark as read actually persists now: opening a story marks it read, the button toggles it, and Viewed stories shows a read check. Titles are only translated when needed — a title already in your language's script is never re-translated.",
			},
			{
				type: "fixed",
				text: "Navigating between pages now starts at the top; duplicate back buttons are gone; the Add Source form marks required fields and tells you which ones Test needs.",
			},
			{
				type: "new",
				text: "Search lives where you expect it: a search box right on the Brief filters the stories in front of you (respecting your sort), and a Search Page button leads to the full researcher search.",
			},
			{
				type: "new",
				text: "'Update my brief' does it all in one tap — collect new stories, then regenerate the brief. Collect and Generate Brief stay for fine control.",
			},
			{
				type: "new",
				text: "Story cards are yours: mark a story read right from the card, switch view from the More menu, and reorder or re-pin the card buttons (drag & drop) in Settings → General → Story card actions.",
			},
			{
				type: "new",
				text: "Provider help where you configure it: each LLM provider shows a link to its model docs, Gemini calls out the free gemini-3.1-flash-lite tier (500 req/day, as of Aug 2026), and Ollama explains it's a host provider whose models change.",
			},
			{
				type: "fixed",
				text: "The Settings search now rings the exact card that matches — including sub-cards — and the insight page leads with the Takeaway, then the technical context.",
			},
		],
		technical: [
			{
				type: "new",
				text: "Engine network access: CORS origin allowlist evaluated per request (immediate), listening host resolved at startup; GET /network reports the resolved view.",
			},
			{
				type: "fixed",
				text: "Source-list counts now include the cached definitions (sources_json) alongside materialized rows, fixing the count the SQL join alone missed.",
			},
			{
				type: "new",
				text: "Ollama connects over the native /api/chat protocol with an optional bearer key — local and cloud from one provider, no new dependency.",
			},
		],
	},
	{
		version: "1.8.0",
		codename: "Extend The Signal",
		date: "2026-08-09",
		summary:
			'Vorynth can now collect from almost any site — not just feeds. Three new source adapters (an HTML crawler, Sitemap, and a generic JSON API) join RSS, GitHub releases, and arXiv, each registered as a plugin you can see and toggle on a new Plugins page. The Add Source form grows per-method configuration fields driven by each plugin, and a Test button dry-runs a setup before you save it. Sources you configure now actually collect — the old form saved HTML/API/Sitemap sources that silently collected nothing. And plugins are no longer just about sources: runtime UI plugins can now extend the app itself — a sidebar entry, a Settings section, a Documentation guide, or even a whole theme — and a built-in Reference Plugin ships as a working example of every contribution, kept in step with the app version. Sources themselves are now organized into curated lists — an official Developer & Software Engineering starter list ships with 25 feeds, community lists are contributed through the GitHub repo and work offline once downloaded, every source can be edited in place, and 18+ lists stay hidden by default. The interface also ships in 10 languages out of the box — English, فارسی, العربية, 한국어, 日本語, 中文, עברית, Español, Deutsch, Русский — each laid out with the correct text direction (RTL for Arabic, Persian, and Hebrew), and both the UI language and the AI Output Language pickers are now searchable: type a native name, an English name, or a code (e.g. "Persian", "فارسی", or "fa") to jump straight to it.',
		changes: [
			{
				type: "new",
				text: "HTML Crawler adapter — for sites with no feed at all. Point it at a listing page, give it CSS selectors for the article containers and links, and Vorynth follows each link and extracts the story from the page with your title, content, date, and author selectors. Leave the item selector empty to treat the URL itself as a single article.",
			},
			{
				type: "new",
				text: "Sitemap adapter — sites that publish a sitemap.xml. Vorynth reads the URL list from the sitemap and fetches each listed page as a story.",
			},
			{
				type: "new",
				text: "JSON API adapter — structured data endpoints. Give it the endpoint and the field names for title, content, URL, date, and author, and each record lands as a story. Optional headers let you reach keyed endpoints.",
			},
			{
				type: "new",
				text: "Plugins page — every adapter Vorynth uses to collect sources now lives in one place with its name, version, and what it does. Core adapters (RSS, GitHub releases, arXiv, Sitemap, and JSON API) carry the Core badge, and every plugin can be switched off: disabling an adapter pauses its sources without touching them, and they resume exactly as they were — one source enabled, another disabled stays that way — when you turn it back on. Runtime UI plugins are listed here too — the ones that extend the app itself — each with its own badge and toggle.",
			},
			{
				type: "new",
				text: "Runtime UI plugins — a plugin can now extend the app itself, not just collect sources. It can add its own sidebar entry with a page, its own section on the Settings page, a guide on the Documentation page, or even a whole theme. Switch it off on the Plugins page and its contributions disappear until you turn it back on — no restart needed.",
			},
			{
				type: "new",
				text: "Reference Plugin — a built-in plugin that demonstrates every kind of contribution: a Solar Flare theme, two persisted settings toggles, its own Documentation guide, and a sidebar page. It ships off — you switch it on in Plugins when you want the example running — and stays in step with the app version, so it doubles as the template for building your own plugin.",
			},
			{
				type: "new",
				text: "Theme picker — Settings → Appearance now lets you choose any theme the app knows: Light, Dark, or one shipped by a plugin (like the Reference Plugin's Solar Flare). The whole app re-skins instantly, and your choice is remembered.",
			},
			{
				type: "new",
				text: "Themes have their own identity — a plugin theme can carry its own icon (shown in the theme toggle and the Settings picker instead of the plain sun/moon) and even a canvas background, a gradient or image that tints the whole app. Light and Dark each keep their own sun/moon icon.",
			},
			{
				type: "new",
				text: "Plugins page badges — each plugin now shows a small tag for what it ships, right next to its Core/UI badge: Theme, Icons, or Fonts. The badge comes from the plugin's manifest, so it shows whether the plugin is on or off.",
			},
			{
				type: "new",
				text: "Icon Pack — a new core plugin that ships the app's icon and font library fully offline: Lucide (1,999 icons), Font Awesome Solid and Brands, Material Symbols, and 18 font families — Vorynth's own Newsreader and Geist, popular Latin fonts (Inter, Roboto, Lora, Open Sans, Montserrat, Poppins, JetBrains Mono), and fonts for Persian/Arabic, Hebrew, Devanagari, Thai, Japanese, Chinese, and Korean. A gallery at /plugin/icons searches every icon and previews every font; other plugins consume the pack through the plugin SDK, so nothing needs the network.",
			},
			{
				type: "new",
				text: "Install and remove plugins — press Install plugin on the Plugins page and pick a .vorynth-plugin file: a single package holding the plugin's manifest and code, built by the plugin author. The engine validates it, installs it, and the plugin appears under Installed with its version and badges, contributions working — no folder digging and no network involved. Power users can still drop a plugin folder into data/plugins and press Scan. Installed plugins get a Remove button that deletes the plugin and its bundle; built-ins can only be switched off.",
			},
			{
				type: "improved",
				text: "Plugins page organized — plugins are grouped into Core, Installed, and Built-in sections, and a search box filters them as you type. A 'Hide core plugins' toggle keeps the list focused on what you added and is remembered across restarts. The Scan button and the plugins folder path sit right next to the list, so adding a plugin is discoverable from the page itself.",
			},
			{
				type: "improved",
				text: "Every connector wears its own icon — RSS, GitHub releases, arXiv, the HTML crawler, Sitemap, and the JSON API each have a distinct one on the Add Source method buttons, in the sources list, and on the Plugins page. The icon comes from the plugin's own manifest, so a connector looks the same wherever you meet it.",
			},
			{
				type: "improved",
				text: "Connectors show whether they're actually collecting — the Plugins page marks each adapter 'In use' when at least one enabled source runs through it, or 'Idle' when none does. The state is derived live from your sources, so it's always accurate and there's nothing to configure.",
			},
			{
				type: "improved",
				text: "The Plugins page is now behind an 'Advanced' switch — Settings → Advanced → Show advanced features. It's off by default: the connectors your sources need resolve behind the scenes, so 'plugin' terminology stays out of the way for everyone who never asked to manage machinery. Turn it on and the Plugins page appears in the sidebar, ready for power users.",
			},
			{
				type: "new",
				text: "Official connectors — arXiv is the first one: a source type that's no longer built-in Core, but is still built and live-tested by Vorynth. The connector health check actually collects against a real reference source, so the 'Official' badge means it demonstrably works — not just that Vorynth wrote it. Official connectors get their own section on the Plugins page and toggle exactly like built-ins.",
			},
			{
				type: "new",
				text: "Connectors can carry their own custom icon — a local artwork file instead of an icon-pack glyph (arXiv ships its own red X mark). Everything stays offline; nothing needs the network.",
			},
			{
				type: "new",
				text: "Official connectors now come from the GitHub connector registry — the 'source needs a connector → fetch it → use it' flow. When you create or test a source of a type whose official connector isn't installed yet (like arXiv), Vorynth provisions it from the registry automatically; 'Check GitHub for connectors' on the Plugins page does it on demand. Connector definitions (config fields, icon, version) update without an app update.",
			},
			{
				type: "improved",
				text: "The Add Source form shows exactly the configuration each method needs — selectors for HTML, field mapping for the API — generated from the plugin itself, with a Test button that dry-runs your setup (no saving) and shows a few sample stories so you can check your selectors before you commit.",
			},
			{
				type: "fixed",
				text: "HTML, API, and Sitemap sources now actually collect. Before, the form saved them but the engine routed every method through the RSS adapter, so those sources silently produced nothing on every run. Each method now resolves to its own adapter.",
			},
			{
				type: "fixed",
				text: "A plugin's sidebar entry used to flicker — sometimes appearing only after a page refresh, sometimes not at all, depending on load order. Plugin contributions now subscribe to the loader, so the menu, Settings sections, Docs guide, and theme picker always reflect plugins as they load.",
			},
			{
				type: "improved",
				text: "First-run and shell copy rewritten in plain language — the welcome screen now explains Vorynth in one sentence and reassures you that your sources, stories, and reading history stay on this device. The optional AI step is framed as 'Make it smarter (optional)' instead of 'Engine Configuration', the engineering step codes ('STP_01: INTRO') and 'System Readiness: Optimal' are gone, and the sidebar's 'Local Engine Active' is now 'Private & local'.",
			},
			{
				type: "improved",
				text: "The welcome screen is skippable — a 'Skip setup' button on every step applies the default settings (News mode, no AI provider) and takes you straight to your brief, and finishing the flow is remembered too, so the welcome only shows until you've made that choice. Settings has a new 'Welcome & Setup' card: a toggle controls whether the welcome shows on startup, and 'Open the welcome screen' re-runs the flow any time — skipping never locks you out.",
			},
			{
				type: "improved",
				text: "The Icon Pack is now always on — it powers the app's own icons and fonts, so its switch is gone and the Plugins page marks it 'Always on'. Everything it ships now loads from inside the app: Material Symbols, Newsreader, and Geist come from the bundle instead of Google's servers, so Vorynth looks and works exactly the same offline, with nothing fetched from the network.",
			},
			{
				type: "new",
				text: "Open the plugins folder — the Plugins page shows where Vorynth keeps plugins, and now 'Open folder' reveals that folder in your file manager (Finder on macOS, File Explorer on Windows, your Linux file manager) while 'Open in terminal' opens a terminal right there — Windows Terminal or PowerShell on Windows, Terminal.app on macOS, and your distro's default terminal on Linux.",
			},
			{
				type: "security",
				text: "Installed plugins are now security-scanned. Every plugin's code is inspected for risky patterns — code injection like eval and string-based timers, calls to external sites, hardcoded IP addresses, and unsafe HTML injection — when it's installed and whenever you press Scan for plugins. A warning badge on the plugin row shows the result and opens the details behind it; plugins flagged High ask for a one-time confirmation before you can enable them. Built-in Vorynth plugins are trusted and never scanned, and plugins now run through a narrow SDK — they no longer get access to the raw engine API, so a plugin can't quietly reach engine commands that change your data.",
			},
			{
				type: "new",
				text: "Source lists — sources on the Sources page are now organized into curated groups with a name, a description, an origin badge, and a master on/off switch. An official Developer & Software Engineering list ships with 25 stable feeds across AI, programming languages, web, backend, devops, cloud, security, and open source. Turning a list off hides its sources from the page and the crawler — nothing is deleted, and turning it back on restores them with every edit you made intact.",
			},
			{
				type: "new",
				text: "Community lists — browse lists contributed through the Vorynth GitHub repo: press 'Check GitHub for lists' and community lists are downloaded once and cached, so they keep working fully offline. Each downloaded list is validated before it's stored — a list referencing unknown adapters or invalid configurations is skipped, never saved — and a failed check never deletes what you already have. Lists are opt-in: a newly downloaded list starts hidden until you add it, and lists whose file leaves the repo stay on your device.",
			},
			{
				type: "new",
				text: "Edit a source — every source now has an Edit button that opens the form pre-filled with its name, category, and configuration fields. Change what you need and save; the type is fixed once a source exists, and the URL and time range stay on the row itself. Sources you create yourself ('My sources') also keep a Delete button; sources inside a list are owned by the list, so they're edited but never individually deleted — hide the list instead.",
			},
			{
				type: "new",
				text: "Search sources — the search box on the Sources page filters sources by name, URL, or category, and filters the list cards too, so you can find a feed or a whole group as you type.",
			},
			{
				type: "new",
				text: "18+ lists — a community list can be flagged 18+, and the user's age is unknown, so these lists show an 18+ badge, are hidden from browsing by default (Settings → Source lists → 'Hide adult lists'), and enabling one asks for confirmation first.",
			},
			{
				type: "improved",
				text: "The Sources page was redesigned around lists: enabled lists as collapsible groups with their sources inside, a dedicated 'My sources' section for what you created, a 'Browse community lists' section for what you can add, and a refresh summary after checking GitHub that reports exactly what was added, updated, or skipped.",
			},
			{
				type: "new",
				text: "Browse sources by category, country, city, or language — the Group by selector on the Sources page turns the flat list into grouped cards: every source sharing a tag in one card, with a master switch that enables or disables the whole group at once and individual toggles inside. Each source row also shows its language as a small badge (en, es, …) with the full name on hover, and the Add/Edit source form has optional Country, City, and Language fields — every official source already ships with them, and you can set or correct them for any source any time.",
			},
			{
				type: "new",
				text: "Source semantic metadata — every source now carries three optional labels that describe what it IS, beyond its feed: Scope (how broadly its subject matters — Global, Regional, National, Local, Community), Authority (how credible it is — Official, Research, Media, Community, Aggregator, Personal), and Impact areas (what fields it touches, e.g. ai, security, cloud). The Add/Edit form offers a suggested vocabulary you can tap to add, or type your own; each source row shows an Authority badge with an explanation on hover. Every official source already ships classified. Today these labels are stored and editable — they're the data layer the intelligence engine will reason over later.",
			},
			{
				type: "fixed",
				text: "The Add Source dialog no longer lets its content spill over the Cancel/Add buttons or scroll the page behind it. The form now scrolls inside the dialog, the buttons stay pinned and clickable at any window size, and the page behind stays locked while the dialog is open.",
			},
			{
				type: "new",
				text: "Story Renderer — a core, always-on plugin that turns any story into a portable artifact. In the reader, the footer's Export button opens a panel with three formats: Markdown (a .md file with the title, source, and body), a themed HTML page (one self-contained .html file with a clean editorial theme that works offline and opens anywhere), and a screenshot — the themed story rendered to a ready-to-share PNG. Everything is generated locally. Its Settings section toggles whether exports include the story's metadata and whether they prefer the translated text when one exists.",
			},
			{
				type: "new",
				text: "Download media with copyright — every kept media item on the Media page now has a Download button with a small menu: 'Download with attribution' draws a credit bar into the image naming the blog, the article title, and the source URL (plus the download date), and 'Download original' saves the file exactly as stored. Videos download as the original — credit can only be drawn into images. Before the first download a dialog warns that the blog's privacy policy may restrict it and lets you proceed; 'Don't show this again' turns the warning off, and Settings → Media turns it back on anytime.",
			},
			{
				type: "new",
				text: "Media previews — every kept item on the Media page now shows what the file actually is: images render as a thumbnail (click to view full size) and videos play inline — all streamed from the local copy, so previews work offline.",
			},
			{
				type: "new",
				text: "Copyright & Attribution plugin — a core, always-on plugin whose setting picks the download default: attribution first or original first. Each download's menu still offers both choices, and its guide lives under Plugins in this Documentation page.",
			},
			{
				type: "new",
				text: "Translate one story — stories that aren't translated yet show a Translate button next to the title, both on the Brief card and in the reader. One tap translates the title and body on demand into your intelligence language, using the same engine path as Translate Stories; the Original/Translated toggle then appears as usual.",
			},
			{
				type: "improved",
				text: "Full text for bot-blocked sites — stories whose site refuses every automated reader (openai.com and other Cloudflare-fronted blogs) now get their full body from an archived copy on the Wayback Machine, so the data health check can complete them and snippets stop staying short forever.",
			},
			{
				type: "fixed",
				text: "A source whose feed returns a structured author (Google AI Blog) no longer fails to collect — the whole feed used to be silently skipped. The author name is now read correctly from the feed.",
			},
			{
				type: "fixed",
				text: "Three starter feeds that had moved or broken (Cloudflare Security, React Blog, OpenSSF) now point at working URLs and collect again. 2ality — JavaScript and more was taken offline by its author and is no longer part of the starter list.",
			},
			{
				type: "new",
				text: "Re-collect one story — every story now has a Re-collect button next to Save, on the Brief card and in the reader. It re-fetches that story's original article, refreshes its full text, re-translates anything that went stale, and fills a missing AI analysis — the daily health check, scoped to a single story, on demand.",
			},
			{
				type: "improved",
				text: "Generate now also translates — clicking Generate on a story with no AI analysis creates the insight AND translates the story into your language, so the card stops looking half-done (the Translate button disappears once the translation exists).",
			},
			{
				type: "fixed",
				text: 'Damaged story text is detected and repaired. Some pages once leaked inline JSON and media-player labels into the stored body (a Google AI story rendered raw `{"play_video":…}` junk). New extractions strip that noise, the daily health check re-extracts already-damaged stories from their source, and a damaged story now tells you and offers Re-collect instead of showing broken text.',
			},
			{
				type: "improved",
				text: "Incomplete translations get fixed instead of lingering — if a stored translation is truncated or carries leftover template tokens, the daily health check re-translates it and a Re-translate option appears on the story until it's whole again.",
			},
			{
				type: "improved",
				text: "The reader renders rich formatting now. Stories whose feed publishes full HTML show bold, links, lists, and quotes instead of raw `<p><strong><a>` markup — and the Brief card's preview strips the markup so it reads as clean text. Formatting is sanitized before it renders (no scripts, no remote images) and links open in a new tab.",
			},
			{
				type: "fixed",
				text: "Modals no longer run off-screen. The Add Source dialog (and every other dialog) now caps at 85% of the window height with the fields scrolling inside and the Save/Test buttons pinned — and a scrollable region shows a soft fade at its edge, so it's always obvious there's more below instead of content being silently cut off.",
			},
			{
				type: "new",
				text: "Reader action bar — the reader's bottom bar keeps the actions you use most (Mark read, Save, Share, Back) and tucks the rest behind a 'More ⋮' menu. Which actions stay up front is your call: Profile → Reader actions pins or unpins each one, so someone who always exports can keep Export at hand.",
			},
			{
				type: "improved",
				text: "The 'text looks damaged' note is honest now. It only fires on real page-interface leaks (media-player labels, double-bracket template tokens, JSON data blobs) — {{template}} syntax, 'Posted in:' footers, and code samples no longer set it off — and its wording says what it actually detected instead of calling the story damaged.",
			},
			{
				type: "improved",
				text: "Right-to-left text stays right-aligned everywhere — Persian/Arabic/Hebrew titles, authors, notes, and history entries now mirror correctly across the archive, history drawer, and story pages, matching the Brief.",
			},
			{
				type: "new",
				text: "Setup is more complete — the welcome flow now actually saves the AI service you pick (your key used to be collected and then dropped), offers Anthropic, and adds a 'What matters to you?' step that records the categories you care about so your brief starts tuned to you.",
			},
			{
				type: "new",
				text: "Export anywhere — the Story Renderer's Export isn't just for the reader anymore. AI insights, Ask-AI answers, saved history entries (searches, briefings, generations), and the Generate Brief period summary all carry an Export button that downloads the content as Markdown, a themed HTML page, or a ready-to-share screenshot — with its cited sources when it has them.",
			},
			{
				type: "improved",
				text: "Re-translate sits right next to Re-collect in the reader footer — a translated story can force a fresh LLM translation of title and body without re-fetching the origin (handy after switching your intelligence language), and the action is pinnable in Profile → Reader actions like the rest.",
			},
			{
				type: "new",
				text: "Start without a window — a Settings toggle makes Vorynth launch straight to the menu bar with no window at all (the window is created invisible, so there's no flash). Pairs with Launch at login: Vorynth starts at sign-in but stays quietly in the menu bar, and the tray or Dock icon opens it. On macOS the Dock icon is hidden too while this mode is on, so nothing pops into the Dock until you bring the window back.",
			},
			{
				type: "new",
				text: "Launch at login — a Settings toggle registers Vorynth to start automatically when you sign in, in your system's own location: Login Items on macOS, Startup apps on Windows, Startup Applications on Linux. Toggle it off to remove the entry again.",
			},
			{
				type: "new",
				text: "Run in background — a Settings toggle keeps Vorynth working after you close the window: it hides to the system tray instead of quitting, leaves the Dock entirely (on macOS the Dock icon disappears too — no dead icon to click), keeps collecting your sources in the background, and a tray menu (Show Vorynth / Quit Vorynth) brings it back or exits for real. The engine's background jobs (collection, data health, reports) keep running while hidden. Clicking the tray icon only ever brings the window back — the window hides only when you close it.",
			},
			{
				type: "improved",
				text: "The reader's 'More ⋮' menu opens upward — the story footer sits at the bottom of the window, so the menu now rises above it instead of falling off-screen. And in Profile → Reader actions, pinning more than five actions shows a tip that the bar is designed for five.",
			},
			{
				type: "fixed",
				text: "The packaged app launches even when another Vorynth instance (or the dev engine) already holds the default port — the shell picks the next free port and tells the UI which one to use. This also fixes a blank-window bug where the app's own security policy stopped the interface from loading at all in the packaged app.",
			},
			{
				type: "new",
				text: "Translations follow a language change — switching your AI output language now translates the stories you already collected, not just new ones. The moment you change it, a background job starts translating the untranslated backlog into the new language (visible in the Jobs tray), and changing it again re-runs.",
			},
			{
				type: "new",
				text: "Insights translate too — Translate and Re-translate now also translate the AI analysis itself (Why it matters, Impact, Takeaway), so an English analysis doesn't sit next to a Persian story. On the insight's page a new Original/Translated toggle shows the analysis as it was first written.",
			},
			{
				type: "improved",
				text: "Story cards got a More menu — Translate/Re-translate, Re-collect, and the Article/Insights card view all live behind the footer's More button, so the footer itself stays Read source · on source · Save · More. A story with an AI analysis flips between Insights view (Why It Matters / Impact / Takeaway — the default) and Article view (the raw post) from the menu.",
			},
			{
				type: "improved",
				text: "Story actions run as visible jobs — Translate, Re-translate, and Re-collect on a story now start a background job that shows a live progress bar in the jobs tray (bottom-right) and spins the card's More button while it runs, instead of a silent one-off request. You can start one and navigate away; the engine finishes it and the Brief reflects the result when you're back.",
			},
			{
				type: "fixed",
				text: "Re-translate no longer silently does nothing — a long translation (title + full text + insight) could come back from the AI model with its closing JSON bracket missing, and Vorynth used to discard the whole result as unreadable. It now repairs the truncated output, so switching your intelligence language and hitting Re-translate actually rewrites the story (and its insight) into the new language.",
			},
			{
				type: "fixed",
				text: "The AI insight follows a language change too — on very long articles the model could translate the story's title and body but leave the AI analysis (Why It Matters / Impact / Takeaway) in its old language. Vorynth now detects that and re-asks the model for just the analysis, so an insight never sits in the wrong language next to a translated story.",
			},
			{
				type: "improved",
				text: "Search and Archive find a story by either title — a translated story keeps its original title searchable (keyword search and the Archive filter match both), and Archive and Search cards show the original title under the translated one.",
			},
			{
				type: "fixed",
				text: "The Archive action actually archives — clicking Archive now moves the item into the archived view instead of doing nothing. Archived items also get a permanent Delete action (with a confirmation first) that removes the item, its notes, tags, and any bookmark for good.",
			},
			{
				type: "improved",
				text: "Insight exports finally look like insights — an insight's export keeps its labeled Why it matters / Impact / Takeaway sections instead of dumping them as anonymous paragraphs, so it no longer looks identical to an article export. The HTML export now wears the app's own theme (colors and fonts, light and dark).",
			},
			{
				type: "fixed",
				text: "Back buttons only appear when there's somewhere to go back to — on pages like Plugins and Media the Back button is hidden when you landed there directly (deep link or restored session) instead of going nowhere.",
			},
			{
				type: "fixed",
				text: "The running-jobs icon now spins the right way — the sync glyph's own arrow made the clockwise spinner read as backwards; it uses a clockwise-friendly icon instead.",
			},
			{
				type: "improved",
				text: "The 'Hide 18+ lists' setting is now explicit: it only hides community source lists flagged 18+ from the Sources page — stories, insights, and search results are never filtered by it.",
			},
			{
				type: "new",
				text: "Insights are generated in two languages at once — the story's own language and yours — in a single request, so every new AI analysis carries both versions. An insight export now includes both side by side: the analysis in your language, then the same analysis in the story's original language.",
			},
			{
				type: "improved",
				text: "Technical terms now translate properly: names like Cloudflare, Kubernetes, and CVE IDs are written in your language with the original term in parentheses on first mention (e.g. کلودفلر (Cloudflare)) — in story translations and AI analyses alike.",
			},
			{
				type: "new",
				text: "The period briefing (Generate Brief) is now bilingual — it's written in your AI output language AND keeps an original version in the majority language of its stories, generated in the same request. An Original/Translated toggle flips the whole briefing, and the export includes both.",
			},
			{
				type: "new",
				text: "Settings → Summary original language — choose the briefing's original version: Auto (the majority language of the summary's stories) or pin a specific language. The translated version always follows your AI output language.",
			},
			{
				type: "new",
				text: "Sources get free-form tags — the Add/Edit form now has a Tags field: type to get live suggestions drawn from a built-in technology vocabulary, your own categories, and tags you already use, and commit one with a comma, Enter, or the + button. Up to 12 tags per source, shown as chips on the row and removable with a click — they describe your sources in your own words, and stay free-form (the vocabulary is only a suggestion).",
			},
			{
				type: "new",
				text: "Profile → Identity grows an Education & experience block — your field of study, degree level, and experience level. Vorynth will soon use this to suggest sources, categories, and tags matched to your field and degree; everything else stays accessible until then.",
			},
			{
				type: "new",
				text: "Backups you can see — Settings → Backup lists every snapshot on disk with its kind (a full Vorynth backup or a plain database file) and date, a download button that saves a copy to your Downloads folder, and a delete button that removes it. Backups are no longer invisible files.",
			},
			{
				type: "new",
				text: "Story views — the History drawer gains a tab that records which stories you opened, when, and whether you saw the AI insight, the article, or both in one sitting. A quiet, browsable log of your reading, ready to power smarter surfaces later.",
			},
			{
				type: "improved",
				text: "The insight's closing section is now called Takeaway — one line on what to remember from the story — instead of Recommended Action, on both the Brief card and the insight page.",
			},
			{
				type: "new",
				text: "Collected stories translate themselves — when a collect run pulls in new stories and an AI provider is configured, Vorynth automatically starts a translation job for them (visible in the jobs tray), so fresh stories arrive in your intelligence language without pressing Translate. In News mode — no API key — nothing is translated and nothing is queued.",
			},
			{
				type: "improved",
				text: "Stories with an AI analysis open showing the insight first — the card defaults to the Insights view (Why It Matters / Impact / Takeaway), and the raw article is one tap away under Article view in the footer.",
			},
		],
		technical: [
			{
				type: "new",
				text: "Adapter plugin registry (`PluginsService`) — built-in manifests (id, name, version, type, dependencies, config schema) seed the existing `plugins` table; `adapterFor(type)` replaces the hardcoded `defaultAdapterFor` that pinned everything to RSS. The crawler gates each source on the plugin's effective enable state (self + dependency cascade).",
			},
			{
				type: "new",
				text: "Three new `SourceAdapter`s (`html`, `sitemap`, `api`) share a cheerio-based extraction helper (`html-extract.ts`, R-D05) and honor the per-source fetch window + hash dedup already centralized in `CrawlerService`. Config validation on source create enforces each plugin's required fields before insert.",
			},
			{
				type: "new",
				text: "`POST /sources/verify` dry-runs a configuration through the adapter (validate + capped fetch, no persistence) to power the Add form's Test button.",
			},
			{
				type: "new",
				text: 'Runtime plugin host on the desktop — enabled `kind:"ui"` plugin bundles are fetched and blob-imported at startup (`plugin-loader.ts`); the host bridge exposes React, ReactDOM, i18n, `apiFetch`, `navigate`, and `usePluginConfig` on `window.__VORYNTH_HOST__`, surfaced to plugin source through the `@vorynth/plugin-host` SDK alias. `build-plugin-bundles.mjs` (esbuild) bundles `plugins/<id>/src/index.tsx` → `public/plugins/<id>/bundle.js` with react externalized to the host; contributions (default view, `navItems`, `SettingsSection`, `docsSection`, `themes`) aggregate in a zustand store consumed by the sidebar, Settings, and Docs pages.',
			},
			{
				type: "new",
				text: 'Theme system generalized from the light/dark union to arbitrary theme ids — plugin themes register `--color-*` token maps (light+dark triplets) injected as scoped `:root[data-theme=…]` CSS; `data-theme` attr + `.dark` class + persisted `localStorage["vorynth.theme"]` id, with `initTheme` falling back to light for unregistered ids.',
			},
			{
				type: "new",
				text: 'Theme identity — `PluginTheme` gains `icon` (Material Symbols name) and `background: { light?, dark? }` (raw CSS, applied to the app canvas via `:root[data-theme=…] .vorynth-canvas`). `availableThemes()`/`currentThemeIcon()` drive the toggle + picker icons; the reference plugin\'s Solar Flare demonstrates both. Manifests gain `contributions` (`"theme" | "icons" | "fonts"`), surfaced on `PluginInfo` and rendered as contribution badges on the Plugins page.',
			},
			{
				type: "new",
				text: "Icon Pack core plugin — `build-icons-assets.mjs` extracts Lucide (`[tag, attrs]` element trees) and Font Awesome (per-icon viewBox + path) into `public/plugins/icons/*.json`, bundles 18 @fontsource families' woff2 + @font-face rules (unicode ranges kept) into `fonts/`, all gitignored. A zustand asset registry (`asset-registry.ts`) collects registered icon sets + font faces; the SDK (`@vorynth/plugin-host`) adds `<Icon>` (inline SVG from the registry, Material Symbols fallback), `registerIconSet`, `registerFont`, `registerFontCatalog`, `useAvailableFonts`, and `useAssetRegistry`. The icons bundle registers everything at load and ships the gallery at `/plugin/icons`.",
			},
			{
				type: "new",
				text: '`PATCH /plugins/:id` accepts `{enabled?, configuration?}` — `PluginsService.update()` shallow-merges into the `plugins.configuration` JSON column (replacing `setEnabled` as the primary path), so plugin settings persist per plugin and the reference plugin\'s toggles round-trip through `usePluginConfig`. `PluginInfo` gains `kind` (`"adapter" | "ui"`).',
			},
			{
				type: "improved",
				text: "Core adapters are no longer locked (`CORE_PLUGIN_LOCKED` removed) — disabling any adapter pauses its sources purely through the crawler's `isEnabled` gating, never by writing to `sources`, so each source's own enabled flag survives and re-enabling restores the exact previous state. Sitemap + JSON API join RSS/GitHub releases/arXiv as core; the reference UI plugin seeds `enabledByDefault: false`. Desktop: nav/settings/docs/theme consumers now subscribe to the plugin contribution store + theme registry, so late-loading plugins always appear.",
			},
			{
				type: "new",
				text: "Docs blocks (`DocsBlock`/`DocsSection`/`FlowStep`) moved to `@vorynth/types` so plugins and the engine share one contract; plugin `docsSection`s merge into the in-app Documentation page and sidebar TOC automatically (`/docs#reference`), rendering with the same rich blocks as built-in docs.",
			},
			{
				type: "new",
				text: 'Installed plugin registry — additive `installed_plugins` table (id PK, name, description, version, kind, type, contributions, configuration, enabled, bundle_path, installed_at) alongside `plugins`; `resolvePluginsDir()` → `<data>/plugins`. `PluginsService.scanInstalledPlugins()` (startup + `POST /plugins/scan`) walks `data/plugins/<id>/` for a valid `plugin.json` + `bundle.js`, INSERT OR IGNOREs, and drops rows whose folder vanished; `list()` merges built-in manifests with installed rows (`PluginInfo.installed = true`, always `kind: "ui"`), `update()`/config dispatch to the right table, and `uninstall(id, force?)` refuses built-ins (`409 PLUGIN_IS_CORE`) and source-referencing plugins unless forced, then deletes the row + bundle dir. `GET /plugins/:id/bundle` serves the bundle path-traversal-safe; `GET /plugins/dir` exposes the folder.',
			},
			{
				type: "new",
				text: "Desktop host diffing — `PluginHostProvider` now diffs enabled-UI ids against loaded contributions: newly enabled plugins load (installed ones fetch their bundle from the engine), and stale ones unregister their contributions, themes, and module cache — fixing the pre-existing stale-contribution-on-disable bug where a switched-off plugin's menu entry could linger. `usePersistedState` (brief-pattern) stores the Plugins page's hide-core preference under `plugins:`.",
			},
			{
				type: "new",
				text: "`.vorynth-plugin` package install — `POST /plugins/install` accepts the file bytes (`application/octet-stream`); `PluginsService.installPackage()` unzips with `fflate` (new dep, ~8KB, zero-dep), validates `plugin.json` (id/name/version) + `bundle.js`, refuses built-in ids (`409 PLUGIN_IS_CORE`), sanitizes entry names (zip-slip guard) and caps unzipped size (32MB), writes into `data/plugins/<id>/`, and upserts the row — reinstalls refresh the manifest while preserving enabled/configuration. The desktop's Install button reads the picked file via `FileReader` and uploads it. Developer tooling: `scripts/package-plugin.mjs` zips a plugin folder (plugin.json + bundle.js + assets) into a `.vorynth-plugin` file, with a README at `plugins/README.md` documenting the authoring flow.",
			},
			{
				type: "new",
				text: "Icon Pack is locked on — `AdapterManifest` and `PluginInfo` gain `locked` (icons manifest sets it). `PATCH /plugins/:id` refuses disabling a locked plugin (`409 PLUGIN_LOCKED`), `list()`/`isEnabled()` force its effective enable state to true, and the seed self-heals any pre-lock disabled row. `index.html` drops the Google Fonts CDN `<link>`s and instead links the Icon Pack's offline `public/plugins/icons/fonts/fonts.css`, so Material Symbols/Newsreader/Geist load from the bundle at first paint. The Plugins page renders locked plugins with an 'Always on' badge instead of a toggle; the icons plugin's docs section drops the old 'falls back to the CDN fonts' wording.",
			},
			{
				type: "new",
				text: "Desktop OS integration — two `#[tauri::command]`s in a new `shell_ops.rs` (`open_plugins_folder`, `open_plugins_folder_in_terminal`) validate the path is a real directory and launch the per-OS command via `std::process::Command` (Explorer/Finder/`xdg-open`; `wt.exe -d`→`powershell.exe -WorkingDirectory` fallback on Windows, `open -a Terminal` on macOS, `$TERMINAL`/terminal cascade on Linux). Frontend adds the official `@tauri-apps/api` IPC client and a `plugins-folder` util that no-ops outside the Tauri webview; the Plugins page gets 'Open folder'/'Open in terminal' buttons (disabled with a hint in browser dev).",
			},
			{
				type: "new",
				text: 'Plugin security scanner (`security-scan.ts`) — a data-driven regex table over the raw bundle text flags code injection (`eval`, `Function`, string `setTimeout`/`setInterval`, dynamic `import("http…")`), DOM-XSS sinks (`innerHTML`, `document.write`, `insertAdjacentHTML`), network egress to non-loopback hosts (`fetch`/XHR/WebSocket/EventSource/`sendBeacon`, computed targets included), hardcoded non-loopback IPs, and inert Node built-ins/crypto-mining strings; loopback + `tauri://` are whitelisted. Reports persist as JSON in the additive `installed_plugins.security_scan` column (scan at install + every `POST /plugins/scan`; built-ins never scanned) and surface on `PluginInfo.security` as severity + flag list with evidence. The desktop Plugins page renders the warning badge + details panel and gates enabling a High-flagged plugin behind a one-time per-plugin confirmation (`localStorage plugins:ack:<id>`). The `window.__VORYNTH_HOST__` SDK loses its raw `apiFetch` (plugins keep `usePluginConfig` scoped to their own id), Tauri\'s CSP is tightened (`connect-src` pins the engine + dev HMR, `script-src` allows blob plugin bundles), and `.semgrep/plugin-bundles.yml` enforces the same checklist on first-party plugin source in CI, gating releases (semgrep → tests → lint/build → packaging).',
			},
			{
				type: "new",
				text: "Source lists data model — additive `source_lists` table (id/name/description/origin/nsfw/enabled/version/sources_json/curator/timestamps) + `sources.list_id` (NULL = user-created, R-A09: no FK, integrity enforced in the service, mirroring plugins↔sources). `seedSourceLists()` seeds the official developer list (25 sources) and backfills membership for pre-v1.8.0 rows with `UPDATE … WHERE list_id IS NULL` (idempotent; user edits never overwritten via INSERT OR IGNORE).",
			},
			{
				type: "new",
				text: "`SourceListsService` — list/get (live source + enabled counts via leftJoin/groupBy), `enable()` materializes cached `sources_json` definitions as real source rows (INSERT OR IGNORE by fixed id, edits preserved), `disable()` hides only (rows kept, R-A10), `getEnabledListIds()` is the crawler's gate, and `refreshCatalog()` discovers community list files via the GitHub trees API (flexible flat/author-folder layout, `VORYNTH_SOURCES_REPO`/`_REF`/`_RAW_BASE` env overrides) and validates every source against the adapter registry + config schema before storing (R-A06 — invalid entries skipped, never saved). Upserts preserve the user's `enabled` state, new lists start hidden, official ids can't be overridden, a failed fetch never clears the cache, and files that leave the repo are reported (removed) but stay cached. Fetcher is injectable (`CatalogFetcher`) so tests run offline. Daily `refresh-community-sources` scheduler job.",
			},
			{
				type: "new",
				text: "Crawler list gating — `collectSource`/`collectAll`/`enabledCount` skip sources whose list is disabled (precomputed enabled-list-id Set per run), in addition to the existing source.enabled + adapter-plugin gates. Desktop: SourcesPage redesign (list groups, search, My sources, browse + 18+ confirm via ConfirmDialog per R-A12), `SourceFormDialog` create/edit modes (edit prefills name/category/config via dotted-key helpers from `source.configuration`, type fixed, saves via PATCH), `PATCH /sources/:id` accepts `category`, and the `sourceLists.hideAdult` app setting gates adult-list visibility.",
			},
			{
				type: "new",
				text: "Per-story translate — `IntelligenceService.translateStory(id)` reuses `buildTranslationPrompt` (single item) + `parseTranslationBatch` + the same `UPDATE … title/original_title/translated_content` + `ftsUpdateArticle` write path as the batch job, idempotent (already-translated or empty-body rows return untouched), LLM failures rethrown so the UI surfaces them. New route `POST /articles/:id/translate` on the Intelligence controller (avoids a News↔Intelligence circular module import; IntelligenceModule already imports NewsModule) returns the refreshed `ArticleDetail`.",
			},
			{
				type: "new",
				text: "Media download endpoints — `localSummary()` now returns per-article `items: LocalMediaItem[]` (id/kind/url/mime/bytes/caption/keptAt) plus `articleUrl` for attribution credit, and a new `GET /media/local/:itemId/file` streams the kept blob with Content-Type/Content-Disposition via a Fastify `@Res()` reply (`getLocalFile` verifies the row is kept and the file exists on disk, else 404). Desktop: `fetchLocalMediaFile` uses a raw fetch (binary, `apiFetch` is JSON-only); the Media page draws the attribution bar with a canvas helper (`features/media/attribution.ts` — `drawAttributionBar`/`downloadBlob`/`slugify`, isolated for tests); the one-time disclaimer persists `media.showDownloadWarning` (appSettings, re-enableable from a new Settings → Media section).",
			},
			{
				type: "new",
				text: "Two new locked UI plugins + a new contribution type — `story-renderer` (exports Markdown/themed-HTML/screenshot; `toPng` via the zero-dep `html-to-image`, bundled by `build-plugin-bundles.mjs`) and `media-copyright` (download-attribution default) join `icons` as `locked: true` manifests; both contribute a `SettingsSection` + `docsSection` + default view. `PluginBundleExports` gains `StoryExports?: {detail, onClose}`; `plugin-contributions.ts` aggregates it and `ArticleDetailPage` renders contributed export panels in a themed modal (R-A12), exposing an Export action in the floating footer. PluginsPage contribution badges gain `renderer` + `copyright` tags.",
			},
			{
				type: "fixed",
				text: "Feed robustness — `RssAdapter.toCreatorName` coerces structured `<dc:creator>` XML (e.g. blog.google's nested author block, which rss-parser returns as an object) to a plain string, and the crawler write path nulls any non-string author before it reaches SQL (R-A06): a malformed feed — or an untrusted plugin adapter (R-A13) — can no longer crash and roll back a source's entire collect. `fetchPage` now retries 403 responses through the Wayback Machine's nearest snapshot (`web.archive.org/web/2/…`, 15s budget) so bot-protected sites still yield full text; the snippet is kept on any failure.",
			},
			{
				type: "new",
				text: "Content quality + per-story repair — `content-quality.ts` adds `isContentCorrupted` (inline JSON blobs, `[[token]]`/`\\u` escapes, media-player chrome) and `translationIsIncomplete` (template-token escapes + implausible length ratio vs origin, no offline language detection); `extractArticle` strips `script/style/noscript/template/svg/audio/video/canvas/iframe` + JSON-object runs before `.text()`; `enrichArticle(force)` bypasses the 800-char guard so damaged bodies can be re-extracted (swap-junk-for-clean rule). `CrawlerService.recollectArticleContent` + `backfillCorruptedContent` re-fetch and repair, `IntelligenceService.recollectStory` orchestrates content → stale-translation repair → missing insight, `repairIncompleteTranslations` re-translates/clears incomplete bodies, `translateStory(force)` re-translates in place (original_title preserved), and `generateInsight` finishes by translating the story (idempotent, failure never fails the insight). New routes `POST /articles/:id/recollect` and translate `{force}` body; `IntelligenceModule` now imports `CrawlerModule` (acyclic); the health-check runner gains corruption + incomplete-translation phases; `Article` DTO carries `contentCorrupted`/`translationIncomplete`.",
			},
			{
				type: "improved",
				text: "Readability: extracted story bodies keep their paragraph structure — `extractArticle` inserts a break at every block element (`<p>`/`<h2>`/`<li>`…) before flattening, so the reader shows real paragraphs instead of one wall of words. A read-time cleanup strips captured page chrome (Cloudflare nav/byline/newsletter, AWS metadata header + comments stub, OpenAI related-list, Smashing promo, Google POSTED-IN tags) without a 'looks damaged' note, and the health-check repair re-extracts any long flattened body once — stored content stays canonical (R-A05).",
			},
			{
				type: "new",
				text: "Reader action bar + corruption tightening — `content-quality.ts` narrows `isContentCorrupted` to page-interface leaks only (JSON blobs now require a quoted key so `{{mustache}}` isn't flagged; `posted in:`, newsletter copy, and standalone `\\uXXXX` dropped; audio-fallback phrase tightened to 'the audio/video element'), and `backfillCorruptedContent`'s SQL pre-filter widens to catch media-player-chrome-only bodies. `ui.readerPinnedActions` (app_settings, JSON string[]) + `reader-actions.ts`/`ReaderActionBar` split the story footer into pinned vs 'More ⋮' (canonical order, `[]` = all in More); `ReaderActionsSection` on Profile writes the preference; Article + Insight readers consume it. Onboarding persists the chosen provider via `saveProvider` (+ `engine.mode` when usable, Anthropic added) and adds a topics step writing `profile.topics` via `patchProfile`.",
			},
			{
				type: "new",
				text: "Read-time junk cleanup + export everywhere — `content-quality.ts` gains `cleanCollectedText(content, title?)` (strips page-shell lines like Breadcrumb/Copy link/share-bar/newsletter copy/`POSTED IN:`/`This content is generated by Google AI`, player labels, JSON blobs, `[[token]]`/`\\uXXXX` escapes, `Nx` speed labels, then drops leading prefix before the title when found early); `toArticleDto` computes `contentClean` only for corrupted rows (recomputed on read, never stored, R-A05) and the reader + Brief snippet prefer it. Export generalizes: `ExportableContent` (`title/body/translatedBody/url/source/author/publishedAt`) in `@vorynth/types`; the story-renderer plugin's `StoryExports` + all builders take it; host `pluginStoryExports()` props change to `{content, onClose}`; a shared `ExportDialog` renders the panels; Export actions land on the Insight reader footer, the Ask-AI answer (answer + `Sources:` list), the three history detail footers (generated text / answer-or-hits / period brief via a shared `periodSummaryExportContent` helper in `features/brief/`), and the Brief's `PeriodSummaryPanel`. `MenuButton` gains `dropUp` (`bottom-full`) and `ReaderActionBar` uses it; `ReaderActionsSection` shows a >5-pinned tip (`profile.readerActionsOverflow`).",
			},
			{
				type: "improved",
				text: "Dragging over a story card now selects the text instead of opening the story — a clean click is required to open it. A new Profile → Card click toggle turns this off if you'd rather any press-release open the story right away.",
			},
			{
				type: "improved",
				text: "The Insight page now makes clear it's the AI's analysis, not the article: a prominent 'Read the full article' block under Takeaway opens the separate Article reader, so the two pages are easy to tell apart.",
			},
			{
				type: "new",
				text: "Automatic updates — Vorynth checks the official GitHub releases for a newer version and updates itself: it downloads the signed installer, verifies it, installs it in a separate process, and relaunches — no installer file to touch and no manual download. A new version announces itself with a banner on boot (and re-checks every few hours); Settings → Updates shows the current version and a Check for updates button. Works on Windows (NSIS), macOS, and Linux (AppImage). Your data, settings, and sources carry over untouched.",
			},
			{
				type: "new",
				text: "Storage & Usage in Settings — see what Vorynth holds on your disk, each library with its size: the app itself, the database (stories and everything), the media library, backups, and plugins — plus what the engine is using right now: RAM, heap, CPU, uptime, and your system's free memory. Stories and media can be cleared from here behind a confirmation dialog: bookmarked stories and stories inside collections are always kept, and Auto-delete retention is the recommended way to slim the feed instead of wiping everything at once.",
			},
			{
				type: "new",
				text: "Custom themes — any theme (even Light/Dark, whose live colors are captured) can be exported as a JSON file, restyled by an AI with a ready-made prompt ('Customize with AI'), and imported back in seconds. Imported themes live on this device, get Edit / Export / Delete buttons, and behave exactly like plugin themes.",
			},
			{
				type: "new",
				text: "Share your sources — My sources can be exported as my-sources.json: pick a few, name the list, and the file downloads in the exact community-list format. Import it on any device (Import list), share it, or drop it into the Vorynth GitHub repo to become a community source list others can browse.",
			},
			{
				type: "new",
				text: "A notification center — a bell in the top bar (next to the theme toggle) collects what's worth knowing: background jobs finishing and new versions being available, with a badge, mark-all-read, and clear. Optionally mirror events to your operating system's notification center — everything togglable in Settings.",
			},
			{
				type: "improved",
				text: "Settings and Profile search now lands you on the answer — and it speaks your UI language: Persian, Arabic, and the other bundled languages match in their own script, not just English keywords. Typing scrolls to and ring-highlights the matching section (on Enter or the search button, so typing doesn't fight you), and when a setting lives on the other page (language, AI output, reading → Profile; updates, theme, storage → Settings) a hint card takes you straight there — those cross-page tips get priority focus.",
			},
			{
				type: "new",
				text: "Font customization — pick the app's body font from the bundled offline families, import your own .woff2 (kept on device), and drag a text-size slider (85%–130%) that scales the whole interface. Everything resets to the default Geist pairing in one click.",
			},
			{
				type: "improved",
				text: "Motion everywhere: dialogs fade and scale in, the history drawer slides, docs sub-lists fade, and onboarding steps transition — panels no longer pop instantly (a new design rule: every open/close animates).",
			},
			{
				type: "improved",
				text: "Onboarding gets the important choices up front — application language and AI output language pickers on the first step, a tip when no topics are chosen (official sources stay on by default, or disable them right there), a final overview of what you picked, and a progress bar that no longer covers the buttons.",
			},
			{
				type: "improved",
				text: "Media moved into the Archive section (before Trash) instead of its own sidebar entry — still reachable from the brief's media cards; its Back button now always works, falling back to the Archive on direct entries.",
			},
			{
				type: "fixed",
				text: "The packaged Linux app no longer opens without its engine. Linux builds (AppImage, .deb, .rpm) used to look for their bundled engine in the wrong folder and silently start without it — the window opened but nothing collected, updated, or answered. The desktop shell now finds the engine where the installer actually puts it.",
			},
			{
				type: "new",
				text: "Story-view history — additive `story_views` table (article_id, viewed_at, scope) + `StoryViewsService`/controller (`POST /story-views`, `GET /story-views`): each story open is recorded with its scope (insight/article/both, 10-min merge window), joined with articles at read time, surfaced in the History drawer's Story views tab.",
			},
			{
				type: "new",
				text: "Source tags — additive `sources.tags` JSON column + `SourcesService.normalizeTags` (lowercase, hyphenate, dedupe, cap 12, empty→null); the desktop builds a tag vocabulary at build time from `@sparring/tech-catalog` (`scripts/build-tech-vocab.mjs` → committed `src/vocab/tech-catalog.json`) combined with app categories and existing tags, driving `TagInput`'s live suggestions.",
			},
			{
				type: "new",
				text: "Profile education — additive `user_profile.field_of_study` / `degree_level` / `experience_level` columns wired through `ProfileService.update()`/`toDto()`; UI renders the Education & experience block in Profile → Identity.",
			},
			{
				type: "new",
				text: "Backup management — `BackupService.list()` now includes plain `.sqlite` snapshots with a `kind` field, and new `GET /backup/:name/file` (download) + `DELETE /backup/:name` endpoints drive the Settings → Backup list UI.",
			},
			{
				type: "new",
				text: "Auto-translate after collect — the scheduled `collect-all` and the `collect` job runner chain a `translate` job when the run inserted new articles and `IntelligenceService.canTranslate()` (`llm.isAvailable()` — an active provider, News mode excluded) is true; zero new stories or no key → nothing queued. The translate runner's existing WHERE clause keeps the pass idempotent (already-translated rows skipped).",
			},
		],
	},
	{
		version: "1.7.0",
		codename: "Organize The Signal",
		date: "2026-08-02",
		summary:
			"Organizing gets its own home. A new Collections page — a Windows-Explorer style icon view with big folder cards, a breadcrumb, and a ⋯ menu on every folder — turns your archive into folders you can actually browse, while the Archive itself becomes a clean, searchable items list. Every item wears its type on its sleeve, and Back always returns you where you came from.",
		changes: [
			{
				type: "new",
				text: "Collections page — a file-explorer view of your archive, reachable from the Archive section tabs (Items · Collections · Bookmarks · Search · Trash) shown on every Archive page. Categories and folders render as big folder cards (filled for categories): click to select a folder and see its own items below, double-click to go inside. A breadcrumb traces your path, every card has a ⋯ menu for its actions — Add items, New folder, Rename, and Delete — and a + tile creates a new category or folder. An \"Add items\" button next to the item list fills the folder you're inside. Each folder lists only its own items — a sub-folder's items appear when you enter that sub-folder, while the card's count label shows the whole subtree at a glance.",
			},
			{
				type: "improved",
				text: "Archive redesign — a clean single-pane items browser: type filters with icons (Stories, Saved, Summaries, Searches, AI asks), a text filter, 'Show archived', and pagination. Each item type has its own icon badge, and every row can be bookmarked, noted, archived, or moved into a collection.",
			},
			{
				type: "new",
				text: "Collection items are now actionable — click any item inside a folder to open its full detail page (article reader, briefing, or cached search result), or remove it from the collection with a confirmation. Removing never deletes the item — it just moves back to uncategorized.",
			},
			{
				type: "fixed",
				text: "Back now returns you where you came from. Opening an item from the Archive or a collection and pressing Back lands you back in the same folder you were browsing, with your open folders still expanded — instead of jumping to a different page.",
			},
			{
				type: "improved",
				text: "Help is one consistent icon away on every page — a header 'How it works' button deep-links to that page's documentation section, replacing the old 'Read docs' tip cards so pages stay clean. Rich guidance lives in the docs; only where a gesture is genuinely non-obvious (double-click to open a folder) does a short inline hint stay. Docs and Profile have their own documentation sections, including the philosophy behind each feature.",
			},
			{
				type: "improved",
				text: "The five Archive pages (Items · Collections · Bookmarks · Search · Trash) now share one uniform layout — a single header skeleton and a segmented section navigation under the title, with the active section highlighted — so switching between them never shifts your eye. The sidebar's Archive entry is now one clean item: the section tabs own moving between the Archive's sub-pages, the sidebar owns global navigation.",
			},
			{
				type: "new",
				text: "Trash — deleting a collection, folder, or history entry is now a soft delete: it moves to the Trash (a new page under the Archive) instead of being destroyed, and you can restore it exactly as it was. Restoring a collection returns its whole folder tree — items that still point into it come back, items you filed elsewhere keep their new home. 'Delete forever' and 'Empty trash' are the only permanent actions, and they confirm first (warned when saved items are inside). Settings → Trash sets how long entries stay before they're purged automatically (default 7 days; days, weeks, months, or years; 0 keeps everything until you empty it) — and saved items are never auto-deleted.",
			},
			{
				type: "fixed",
				text: "Settings now tells you when a provider's stored key can't be decrypted. If the local encryption key was lost — restoring from a backup or cleaning up your data can do that — the LLM used to stop working with no explanation. Now the provider list marks the key as unreadable and tells you to remove and re-add the provider.",
			},
			{
				type: "fixed",
				text: "Background jobs are never silently dropped anymore. Clicking 'Regenerate all insights' or 'Translate Stories' while a job is already running now creates a visible job that waits its turn and starts automatically when the current one finishes — before, a second click while one was running did nothing at all, and a job with nothing to do finished instantly and looked like it never ran.",
			},
			{
				type: "improved",
				text: "Jobs survive app restarts. If Vorynth closes while a background job (collect, regenerate insights, translate stories, …) is running, it comes back on the next launch and continues from where it stopped — instead of vanishing and making you start over.",
			},
			{
				type: "improved",
				text: "LLM requests are now spaced evenly instead of arriving in bursts. Before, several requests fired back-to-back and the next one then waited out a long one-minute pause; now requests are paced at a steady interval, so long jobs run more predictably and your provider's rate limit is never tripped.",
			},
			{
				type: "improved",
				text: "Translate Stories now translates the full story — title AND body — in one job, sending 5 stories per AI request so large collections finish in a fraction of the calls. Every story keeps its original title and body one toggle away: an Original/Translated toggle sits next to the title in the Brief and next to both the title and the body in the reader. Search and AI analysis keep working on the originals, which are never overwritten.",
			},
			{
				type: "improved",
				text: "Right-to-left text now reads correctly even when a Persian, Arabic, or Hebrew story opens with a URL, number, or emoji. Every content box — article titles and bodies, translated stories, AI answers, insights, summaries, search results, and history pages — now looks at the whole text and picks the direction its majority of characters are written in, instead of trusting the first character. Neutral text falls back to your app's language direction.",
			},
		],
		technical: [
			{
				type: "new",
				text: "Jobs are now durable — a new `jobs` table persists every background job on each mutation (status, progress, input JSON). On boot, interrupted running/queued jobs are restored as queued and re-run from their last checkpoint via a kind→factory runner registry: regenerate skips already-done insights (offset resume), translate is naturally idempotent, and canceled jobs can never flip back to done.",
			},
			{
				type: "improved",
				text: "Rate limiter rewritten from a burst-tolerant sliding window to an even-spacing leaky bucket — `VORYNTH_LLM_SPACING_MS` directly controls the gap between requests (default 60s / RPM), so no more long single waits after a burst.",
			},
			{
				type: "new",
				text: "Translate Stories batches 5 stories per LLM call and parses a validated JSON array back (`parseTranslationBatch` — LLM output validated before storage, R-A06). Body translations land in a new additive `articles.translated_content` column while `content` stays canonical (R-A05); `articles_fts` gains an in-place `ftsUpdateArticle` so translated titles stay searchable. `original_title` is written once and preserved forever.",
			},
		],
	},
	{
		version: "1.6.0",
		codename: "Navigate the Maze",
		date: "2026-08-01",
		summary:
			"Vorynth becomes a personal intelligence workspace. Intelligence and News modes are explicit choices, and the new Archive turns everything you collect — stories, saved items, summaries, searches, AI answers — into an organized, searchable, note-taking space. An in-app Documentation page explains exactly how Vorynth works, search moved into the Archive, sources gained time-range windows, and the app now ships with a real automated test suite.",
		changes: [
			{
				type: "new",
				text: "Mode switch — Intelligence (LLM-generated Why It Matters / Impact / Recommended Action) and News (ranked feed, no AI) are now explicit choices on the Settings page. Vorynth no longer decides for you based on whether a key exists; you can flip modes at any time, and the mode is remembered.",
			},
			{
				type: "new",
				text: "Active provider selection — when more than one LLM provider is configured, choose which one actually serves your calls via 'Set active' on each provider. The active provider is remembered, with the most recently enabled provider as the fallback.",
			},
			{
				type: "new",
				text: "Regenerate All Insights — one button in Settings re-runs the AI triad (Why It Matters, Impact, Recommended Action) for every story, updating existing insights in place using your current AI output language.",
			},
			{
				type: "new",
				text: "Translate Story Titles — translate every collected story's title into your AI output language in a single job. The original title is preserved and you can toggle between translated and original per article in the Brief.",
			},
			{
				type: "new",
				text: "Archive — a unified space for everything Vorynth has collected: stories, saved items, generated summaries, keyword searches, and Ask-AI answers. Create categories and folders, tag items, write notes, and move anything anywhere.",
			},
			{
				type: "new",
				text: "Save (bookmark) — every story now has a real Save action backed by the engine. Saved stories live in the Archive and get their own Bookmarks view — and retention never deletes something you saved.",
			},
			{
				type: "new",
				text: "Documentation & Tutorial — an in-app page explaining every screen, how data is collected, why titles and descriptions differ from the original, and exactly how importance ranking, Ask AI, and the brief summary work. No more black box.",
			},
			{
				type: "improved",
				text: "Search moved into the Archive — one place to find everything (stories, notes, tags, saved items, past searches), plus a new advanced search built for researchers: filter by domain, author, importance, date range, and whether a story has AI analysis.",
			},
			{
				type: "improved",
				text: "Sources page — pick a time window (day, week, month, year, or custom dates) to see what a source has published, with an honest note when older articles were pruned by the retention window.",
			},
			{
				type: "improved",
				text: "Provider deletion now asks for confirmation, with a 'don't show again' option — and the confirmation dialogs can be reset from your Profile so the safety net always comes back if you want it.",
			},
			{
				type: "improved",
				text: "Settings moved out of the sidebar navigation into the footer next to Profile, and the two pages cross-reference each other — app settings live on Settings, personalization lives on Profile, no more guessing which is which.",
			},
			{
				type: "fixed",
				text: "Dark-mode legibility — hover states on buttons, the theme toggle, insight details, and floating action bars no longer wash out their labels. Backgrounds change on hover while the text keeps its original (readable) color.",
			},
		],
		technical: [
			{
				type: "new",
				text: "Archive data model — metadata-only content_items spine linked from the origin tables (articles, search/brief/generated history) via additive columns and unique indexes; no shipped-table rebuilds (R-A01). Bookmarks are a flag on a content item, not a content type, so future bookmarking of AI answers/summaries needs no migration.",
			},
			{
				type: "new",
				text: "Domain invariants enforced and tested — every origin has exactly one spine (startup backfill self-heals), retention pruning skips bookmarked articles, source deletion returns 409 when saved stories exist unless force-confirmed, and collection nesting is capped at depth 3 with category→folder semantics.",
			},
			{
				type: "improved",
				text: "FTS5 articles_fts gained an author column (schema-triggered index rebuild); GET /search accepts author=; a new structured GET /search/advanced endpoint filters by domains, authors, importance tiers, date range, and insight presence.",
			},
			{
				type: "improved",
				text: "Brief entries now expose ranking signals (source reliability, freshness, length) — stored evidence surfaced for transparency, never an AI-generated explanation of its own reasoning.",
			},
			{
				type: "new",
				text: "Testing foundation — Jest + ts-jest for the engine (temp-SQLite harness, offline mocked LLM provider, domain-invariant suite), Vitest + Testing Library for UI components, Playwright for critical user journeys (role/aria selectors only, no data-test-id), Storybook for components with mock data.",
			},
			{
				type: "fixed",
				text: "The Archive's 'Saved' filter was ignored by the engine (the bookmarked query param wasn't wired through the controller) — it now correctly shows only bookmarked items. Bookmarks are also reachable with one click from the Brief and the Archive.",
			},
		],
	},
	{
		version: "1.5.0",
		codename: "Knowledge Paths",
		date: "2026-07-22",
		summary:
			"Vorynth tells its own story now — the name origin, the build system, and every supported platform are documented end-to-end. CI pipelines for Harmony OS, FreeBSD, and Windows have been hardened, and the favicon finally carries the actual Vorynth logo instead of a generic placeholder.",
		changes: [
			{
				type: "new",
				text: "Name origin ('Why Vorynth?') added to the landing page and README — Vor (vision/voyage) + Yn (intelligence network) + Th (thought/depth).",
			},
			{
				type: "new",
				text: "OpenHarmony/Harmony OS setup guide completely rewritten with real SDK URLs, toolchain table, bundle directory layout, DevEco Studio steps, and honest limitations.",
			},
			{
				type: "improved",
				text: "CI no longer runs on doc-only changes (README, AGENTS.md, docs/, .agents/, LICENSE) — saves runner time when only documentation is updated.",
			},
			{
				type: "fixed",
				text: "Harmony OS CI build: NDK download URL corrected to the real OpenHarmony 6.0-Release SDK archive, extraction path fixed, clang wrapper scripts created for the Rust cross-compiler linker.",
			},
			{
				type: "fixed",
				text: "FreeBSD CI build: cargo-tauri CLI now installed via `cargo install` before building — the FreeBSD VM does not ship a prebuilt tauri package.",
			},
			{
				type: "fixed",
				text: "Windows CI deprecation warning (Node 24): `spawn()` with `shell:true` no longer passes array arguments — uses a concatenated command string on Windows and direct array form elsewhere.",
			},
			{
				type: "improved",
				text: "Favicon regenerated from the actual Vorynth logo (not a generic brain) — 4 resolutions (16, 32, 48, 64 px) in a single .ico resource via ImageMagick.",
			},
			{
				type: "improved",
				text: "'Built with ZCode' section added to README — a personal note crediting the tools used during development, explicitly framed as experience rather than promotion.",
			},
		],
	},
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
			{
				type: "new",
				text: "10 bundled UI languages — English, فارسی, العربية, 한국어, 日本語, 中文, עברית, Español, Deutsch, Русский — selectable from the Profile page, each laid out with the correct text direction (RTL for Arabic, Persian, and Hebrew).",
			},
			{
				type: "improved",
				text: 'Searchable language pickers — type the native name, the English name, or the code (e.g. "Persian", "فارسی", or "fa") to filter, in both the UI language and the AI Output Language dropdowns.',
			},
			{
				type: "improved",
				text: "The whole interface now ships translated in all 10 languages — every page, filter, menu, and dialog goes through i18n, so nothing stays in English after you switch the UI language.",
			},
			{
				type: "fixed",
				text: "AI actions now explain why they can't run. When no provider is configured, the API key is missing, or the stored key can't be decrypted, Generate insight, Translate, Re-translate, and the batch jobs show the exact reason (on the story card, under the Settings buttons, and in the jobs tray) instead of a generic failure.",
			},
			{
				type: "improved",
				text: "Settings and Profile are reorganized into categories with a sidebar rail and a search box — every option and its explanation stays visible and reachable, just grouped so a first-time user isn't overwhelmed.",
			},
		],
	},
];
