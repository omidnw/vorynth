import type { DocsSection } from "../types.js";

/** Settings — engine, mode, provider, retention, and data ownership. */
export const settingsSection: DocsSection = {
	id: "settings",
	title: "Settings",
	summary: "Engine status, mode, provider, retention, and data ownership.",
	icon: "settings",
	pageRoute: "/settings",
	blocks: [
		{
			type: "paragraph",
			text: "Settings is where Vorynth's behavior is configured: which mode it runs in, which LLM provider powers the intelligence, how long data is kept, and what you own and control. The settings are grouped into categories — General, Intelligence, Data & Health, Sources, and Plugins — with a category rail on the left (chips on narrow screens) that anchors to each group, and a search box that filters the groups by name or keyword. Every option remains visible; nothing is hidden behind tabs.",
		},
		{
			type: "flow",
			title: "From install to intelligence",
			steps: [
				{ icon: "memory", label: "Engine status" },
				{ icon: "rss_feed", label: "Choose mode" },
				{ icon: "psychology", label: "Add provider" },
				{ icon: "auto_awesome", label: "Generate" },
			],
		},
		{
			type: "features",
			items: [
				{
					icon: "memory",
					label: "Engine Status",
					text: "Version, how many of your sources are enabled, the total article count, and the current mode — a quick health check of the running engine.",
				},
				{
					icon: "psychology",
					label: "Mode — News / Intelligence",
					text: "News mode needs no LLM: stories are ranked by freshness and source reliability. Intelligence mode adds the triad (Why It Matters / Impact / Takeaway) via your provider. Switch any time — both work with the same sources.",
				},
				{
					icon: "rocket_launch",
					label: "Welcome & Setup",
					text: "The welcome screen shows the first time Vorynth starts — it introduces the app and lets you add AI. Skip it any time: defaults apply (News mode, no AI provider) and the app opens. Settings is its home: the 'Show the welcome screen when Vorynth starts' toggle skips or re-enables it, and 'Open the welcome screen' re-runs the flow whenever you like.",
				},
				{
					icon: "psychology",
					label: "Intelligence Provider",
					text: "Optional. Gemini, OpenAI, Anthropic, or a local Ollama server. Add a key (or base URL for Ollama), save, and Test Connection verifies it. Keys are encrypted at rest (AES-256-GCM, machine-bound) and never leave your machine except to the provider's own API.",
				},
				{
					icon: "data_usage",
					label: "Usage",
					text: "Request and token counts for the last 30 days, plus the rate-limit budget the engine runs under (5 requests/min by default) — so long jobs don't silently hit the ceiling.",
				},
				{
					icon: "history_toggle_off",
					label: "Retention",
					text: "Auto-delete collected articles older than a chosen window, keeping the newest N days. Bookmarked articles are never deleted (a bookmark is ownership), and by default articles sitting in a collection are protected too.",
				},
				{
					icon: "delete",
					label: "Trash",
					text: "How long soft-deleted collections and history entries stay in the Trash before they're purged automatically — days, weeks, months, or years (default 7 days; 0 keeps everything until you empty the trash). Saved items are never auto-purged.",
				},
				{
					icon: "sync_problem",
					label: "Re-collect all sources",
					text: "Forces a full re-collect of every enabled source right now — useful after adding many sources or changing the mix.",
				},
				{
					icon: "auto_awesome",
					label: "Regenerate all insights",
					text: "Re-runs the AI analysis (intelligence triad / summaries) over the existing collection, refreshing titles and insights.",
				},
				{
					icon: "translate",
					label: "Translate stories",
					text: "Batch-translates every story's title AND body into your intelligence language — 5 stories per AI request — displayed with an Original/Translated toggle next to the title and next to the body in the reader.",
				},
				{
					icon: "health_and_safety",
					label: "Data health check",
					text: "A daily background job that quietly repairs your stored stories: it detects and re-extracts damaged bodies, fetches the full text of stories that only have a feed snippet, re-translates (or honestly clears) translations that went stale or look incomplete, and — when Intelligence mode is on — generates the missing AI analysis. It runs as a visible job in the tray, respects the LLM rate limit, and can be turned off (or run on demand with 'Run data check now').",
				},
				{
					icon: "palette",
					label: "Appearance",
					text: "Theme picker — Light and Dark, plus every theme a plugin ships (each shows its own icon, and plugin themes can carry a canvas background gradient or image). The system theme is only the initial default. UI language lives on the Profile page, and the language the AI answers in is separate — set both there.",
				},
				{
					icon: "palette",
					label: "Custom themes",
					text: "Make Vorynth yours beyond the built-ins: export any theme (including Light/Dark — their live colors are captured) as a JSON file, hand it to ChatGPT with the ready 'Customize with AI' prompt, and import the AI's answer back — no coding. Imported themes live on this device, are listed under Custom themes with Edit / Export / Delete buttons, and behave exactly like any other theme.",
				},
				{
					icon: "text_fields",
					label: "Fonts & text size",
					text: "Pick the app's body font from the bundled offline families (search the list, or import your own .woff2 — it's kept on this device and works offline), and drag the text-size slider to scale the whole interface (85%–130%). Reset restores the default Geist pairing instantly.",
				},
				{
					icon: "view_list",
					label: "Source lists",
					text: "Hide adult lists by default. This only concerns community SOURCE LISTS flagged 18+ — they stay hidden from the Sources page until you reveal one. It never filters stories, insights, or search results, and nothing is ever deleted.",
				},
				{
					icon: "summarize",
					label: "Summary original language",
					text: "The Generate Brief summary is written in your AI output language; this picks the language of its ORIGINAL version — Auto uses the majority language of the stories in the summary, or pin one. The panel and the saved briefing show both with an Original/Translated toggle, and exports include both.",
				},
				{
					icon: "history",
					label: "History recording",
					text: "Choose what gets recorded into the History drawer: keyword searches are opt-in, Ask-AI and briefings are recorded by default.",
				},
				{
					icon: "photo_library",
					label: "Media",
					text: "Show the media download warning: before the first download Vorynth confirms the blog's privacy policy may restrict it. Turn it off to skip the warning; turning it back on restores it (the same switch the dialog's 'Don't show again' flips).",
				},
				{
					icon: "login",
					label: "Launch at login",
					text: "Starts Vorynth automatically when you sign in to your computer. The OS location is what your system calls it — Login Items on macOS, Startup apps on Windows, Startup Applications on Linux — and the toggle registers (or removes) the entry there.",
				},
				{
					icon: "visibility_off",
					label: "Start without a window",
					text: "Vorynth launches straight to the menu bar with no window — handy when it starts at login, so nothing pops up to interrupt you. The window is created invisible (no flash); click the tray icon or the Dock icon to open it. Takes effect on the next start.",
				},
				{
					icon: "minimize",
					label: "Run in background",
					text: "When on, closing the window hides Vorynth to the system tray instead of quitting: it leaves the Dock entirely (no dead icon to click), the menu bar icon stays available to bring the window back, the engine keeps collecting, and Quit from the tray fully exits.",
				},
				{
					icon: "developer_mode",
					label: "Advanced",
					text: "'Show advanced features' reveals the Plugins page — the source connectors and UI plugins Vorynth runs. Most people never need it: connectors for your sources resolve automatically behind the scenes. Turn it on only if you want to see and manage the machinery yourself.",
				},
				{
					icon: "system_update",
					label: "Updates",
					text: "Vorynth checks the official GitHub releases for a newer version and updates itself: it downloads the signed installer, verifies it, installs it in a separate process, and relaunches — you never touch the installer file. A new version announces itself with a banner on boot and every few hours; 'Check for updates' here runs it on demand. Your data and settings carry over untouched. Automatic updates need the installed app — a development build can check but can't replace itself.",
				},
				{
					icon: "notifications",
					label: "Notifications",
					text: "A bell in the top bar collects what's worth knowing: background jobs finishing (collect, generate, translate, …) and new versions being available. Click a notification to mark it read, 'Mark all read' clears the badge, and Clear empties the list. Turn it off here entirely, or mirror events to your operating system's notification center — macOS asks for permission the first time.",
				},
				{
					icon: "data_usage",
					label: "Storage & Usage",
					text: "What Vorynth holds on your disk, split into its libraries — the database (stories and everything), the media library, backups, and plugins — each with its size, plus the engine's live RAM, CPU, and uptime. Stories and media can be cleared here behind a confirmation: bookmarked stories and stories in collections are always kept, and Auto-delete retention is the recommended way to slim the feed instead of wiping everything at once.",
				},
				{
					icon: "storage",
					label: "Data ownership",
					text: "Backup the whole database to a .vorynth-backup file, restore from one, or delete all data — your data stays on your machine, and you decide.",
				},
			],
		},
		{
			type: "bullets",
			items: [
				"News mode must work with no API key — a provider is an enhancement, never a hard dependency.",
				"Language now lives on the Profile page; Settings links there so nothing is lost.",
				"Re-collect, regenerate, and translate run as background jobs — the page shows their progress and disables the button while busy.",
			],
		},
	],
};
