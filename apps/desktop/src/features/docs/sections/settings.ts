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
			text: "Settings is where Vorynth's behavior is configured: which mode it runs in, which LLM provider powers the intelligence, how long data is kept, and what you own and control. The page is a set of independent cards — each one changes a single aspect, nothing here is hidden behind tabs.",
		},
		{
			type: "flow",
			title: "From install to intelligence",
			steps: [
				{ icon: "memory", label: "Engine status" },
				{ icon: "rss_feed", label: "Choose mode" },
				{ icon: "neurology", label: "Add provider" },
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
					text: "News mode needs no LLM: stories are ranked by freshness and source reliability. Intelligence mode adds the triad (Why It Matters / Impact / Recommended Action) via your provider. Switch any time — both work with the same sources.",
				},
				{
					icon: "neurology",
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
					icon: "palette",
					label: "Appearance",
					text: "Theme (light or dark — the system theme is only the initial default). UI language lives on the Profile page, and the language the AI answers in is separate — set both there.",
				},
				{
					icon: "history",
					label: "History recording",
					text: "Choose what gets recorded into the History drawer: keyword searches are opt-in, Ask-AI and briefings are recorded by default.",
				},
				{
					icon: "database",
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
