/**
 * English catalog — the single source of truth.
 *
 * This is the ONLY language shipped with Vorynth. Every other language is a
 * user-supplied translation: the user exports this object as JSON, translates
 * it in any editor, and imports it back (see Settings → Appearance).
 *
 * Keys are namespaced by screen so adding a new screen is one block. The
 * flat-ish structure makes the exported JSON easy to translate by hand.
 */
export const en = {
	app: {
		name: "Vorynth",
		tagline: "Less reading. More understanding.",
		localEngine: "Local Engine Active",
	},
	nav: {
		brief: "Today's Brief",
		sources: "Sources",
		media: "Media",
		profile: "Profile",
		settings: "Settings",
		generate: "Generate Brief",
		user: "Local User",
	},
	brief: {
		title: "Today's Intelligence Brief",
		timer: "10-minute briefing",
		stories: "{{count}} stories",
		sources: "{{count}} sources",
		intelligenceOn: "LLM intelligence on",
		newsMode: "News mode",
		domains: "Domains",
		importance: "Importance",
		all: "All",
		loadMore: "Load more stories",
		empty: {
			title: "No stories yet",
			body: "Vorynth is ready to collect. Hit Collect to pull the latest from your sources — no API key required.",
			collect: "Collect Now",
			working: "Working…",
		},
		newsHint:
			"<strong>News mode.</strong> Add an LLM provider in Settings to generate the Why-it-matters / Impact / Recommended-Action triad.",
		readOn: "Read on {{source}}",
		intelligenceActive: "LLM Intelligence Active",
	},
	why: "Why it matters",
	impact: "Impact",
	recommendedAction: "Recommended Action",
	sourcesLabel: "Sources",
	settings: {
		title: "Settings",
		subtitle: "Local-first. Everything on this page runs on your device.",
		engine: "Engine Status",
		version: "Version",
		sourcesCount: "{{on}}/{{total}} on",
		articles: "Articles",
		llm: "LLM",
		intelligence: "Intelligence Provider",
		intelligenceHint:
			"Optional. Without a provider, Vorynth stays in news mode.",
		verify: "Verify",
		addProvider: "Add Provider",
		appearance: "Appearance",
		theme: "Theme",
		themeHint: "Light (Precision Minimalism) / Dark (Obsidian Intelligence)",
		language: "Language",
		languageMovedToProfile:
			"Language settings now live on your Profile page, alongside your identity and personalization.",
		languageHint:
			"Vorynth ships in English. Add your own translation by exporting the English catalog, translating it, and importing it back. RTL languages (Arabic, Persian, Hebrew, …) are laid out automatically.",
		active: "Active",
		import: "Import Catalog",
		export: "Export English",
		remove: "Remove",
		builtIn: "Built-in",
		custom: "Custom",
		dataOwnership: "Data Ownership",
		dataHint: "Your data lives in a local SQLite file.",
		exportBackup: "Export Backup",
		restore: "Restore",
		delete: "Delete All Data",
		recollect: "Re-collect all sources",
		recollectHint:
			"Re-fetches every article from every source and updates existing entries in place. Use this when you know articles have changed at their source or you're testing a new collection feature. For a single source, use Sources. Not generally recommended.",
		recollectButton: "Re-collect all",
		recollectConfirm:
			"Are you sure? This will re-fetch every enabled source and update existing articles. Related insights and media are preserved.\n\nThis is only recommended if articles have changed at their source or you're testing a new collection feature.",
		recollectBusy: "Re-collecting…",
	},
	provider: {
		label: "Label",
		model: "Model",
		apiKey: "API Key",
		baseUrl: "Base URL",
		cancel: "Cancel",
		save: "Save Provider",
		saving: "Saving…",
	},
	onboarding: {
		welcome: "Establish Clarity",
		welcomeBody:
			"Vorynth is your local-first engine for distilling vast technical knowledge into a short, ranked brief.",
		privacy: "Privacy Absolute",
		privacyBody:
			"Sources, articles and your reading history stay on this device.",
		begin: "Begin Setup",
		config: "Engine Configuration",
		configBody:
			"Optional. Connect an AI provider to generate the intelligence triad. Skip to stay in news mode.",
		selectProvider: "Select Provider",
		apiKeyHint:
			"Stored encrypted locally; never sent anywhere except the provider.",
		newsOnly: "Skip — News only",
		newsOnlyBody:
			"News mode: Vorynth will collect and rank stories without any AI.",
		continue: "Continue",
		back: "Back",
		ready: "Ready",
		readyBody: "Vorynth will now pull the latest stories from your sources.",
		initialize: "Initialize Engine",
		initializing: "Initializing…",
		systemReady: "System Readiness: Optimal",
	},
	analyzing: {
		title: "Distilling Intelligence",
		body: "The local engine is processing your sources. This takes a moment.",
		collecting: "Collecting sources",
		normalizing: "Normalizing content",
		dedup: "Detecting duplicates",
		classifying: "Classifying topics",
		ranking: "Ranking importance",
		analyzing: "Analyzing impact",
		localizing: "Localizing output",
		report: "Compiling brief",
		running: "Running…",
		done: "Done",
	},
	tiers: {
		signal: "Signal",
		trend: "Trend",
		"low-noise": "Low Noise",
	},
	common: {
		collect: "Collect",
		collecting: "Collecting…",
		generate: "Generate Brief",
		generating: "Generating…",
		back: "Back",
	},
	// v1.1.0 — native article reader + media control.
	article: {
		loading: "Loading…",
		notFound: "Article not found",
		back: "Back",
		backToBrief: "Back to Brief",
		by: "by",
		unknownSource: "Unknown source",
		readOriginal: "Read original article",
		noContent: "No body text was stored for this article.",
		media: "Media",
		mediaFromSource: "streamed from source",
		releaseAll: "Release all",
		fromSource: "remote · from source",
		keptLocal: "kept locally",
		keepLocal: "Keep locally",
		releaseLocal: "Release local copy",
		zoom: "Zoom",
		close: "Close",
		markRead: "Mark read",
		read: "Read",
		save: "Save",
		saved: "Saved",
		share: "Share",
		original: "Original",
	},
	reader: {
		supportTitle: "Support the author",
		supportBody:
			"This story's canonical home is the site that published it — that's where the author gets credit and views. Consider opening the original. You can still read it here if you prefer.",
		article: "Article",
		openOriginal: "Open original",
		readInVorynth: "Read in Vorynth",
		dontShowAgain: "Don't show this again —",
		changeInProfile: "change it later in Profile.",
	},
	profile: {
		title: "Profile",
		subtitle:
			"How Vorynth knows you. Your identity, custom instruction, and reading behavior — all local.",
		loading: "Loading profile…",
		localUser: "Local User",
		localEngine: "Local Engine",
		identity: "Identity",
		firstName: "First name",
		firstNamePlaceholder: "Given name",
		lastName: "Last name",
		lastNamePlaceholder: "Family name",
		alias: "Alias",
		aliasPlaceholder: "A handle you prefer to go by",
		saveIdentity: "Save identity",
		saving: "Saving…",
		saved: "Saved",
		saveFailed: "Save failed. Check the engine is running and try again.",
		customInstruction: "Custom instruction",
		customInstructionHint:
			"A directive that biases how Vorynth's AI responds to you — tone, depth, language, what to emphasize or avoid. Applied to Ask-AI search and generate operations.",
		customInstructionPlaceholder:
			"e.g. Be concise and technical. Prefer examples over theory. Avoid marketing language.",
		improve: "Improve",
		improving: "Improving…",
		improvedPreview: "Improved preview",
		restoreOriginal: "Restore your draft",
		apply: "Apply",
		discard: "Discard",
		save: "Save",
		needProvider:
			"Add an LLM provider in Settings to use AI-assisted features.",
		improveFailed: "Couldn't improve the instruction. Try again.",
		behaviorSummary: "Behavior summary",
		generate: "Generate",
		regenerate: "Regenerate",
		generating: "Generating…",
		generateFailed: "Couldn't generate the summary. Try again.",
		generatedAt: "Generated",
		noSummary:
			"No summary yet. Generate one from your search and briefing history — it describes what you tend to read and search for.",
		interests: "Interests & topics",
		interestsHint:
			"Derived from your history — the categories and queries that show up most across your briefings and searches.",
		topCategories: "Top categories",
		recentSearches: "Recent searches",
		noActivity:
			"No activity yet. Run a search or read a briefing to populate this.",
		readerSettings: "Reader settings",
		supportReminder: "Show 'support the author' reminder",
		supportReminderHint:
			"Nudges you toward the original site before opening the in-app reader.",
		keepMediaLocal: "Keep media locally by default",
		keepMediaLocalHint:
			"When on, media from articles you open is downloaded for offline reading. Off by default — media streams from the source.",
		aiLanguage: "AI Output Language",
		aiLanguageHint:
			"The language Vorynth's AI uses when answering your questions, generating briefs, and writing summaries. Choose the language you want insights in.",
	},
	media: {
		title: "Local media",
		subtitle:
			"Article media you've chosen to keep on this device. Nothing is stored without your explicit opt-in — release anything here, or purge it all.",
		back: "Back",
		loading: "Loading…",
		totalSize: "Total size",
		articles: "Articles",
		items: "Items",
		itemsUnit: "items",
		empty: "Nothing kept locally",
		emptyBody:
			"Open any article and tap the keep icon on a media item to store it here for offline reading.",
		release: "Release",
		purgeAll: "Purge all",
		purgeConfirm:
			"Delete every locally-kept media file? Articles themselves are not affected.",
		unknownSource: "Unknown source",
	},
};

export type TranslationCatalog = typeof en;
