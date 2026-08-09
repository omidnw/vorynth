import type { DocsSection } from "../types.js";

/** Today's Brief — the ranked home screen (project philosophy in one view). */
export const briefSection: DocsSection = {
	id: "brief",
	title: "Today's Brief",
	summary:
		"Your ranked, readable snapshot of what matters right now — the heart of Vorynth.",
	icon: "today",
	pageRoute: "/brief",
	blocks: [
		{
			type: "paragraph",
			text: "The Brief is Vorynth's default view and its philosophy in one screen: 'Less reading. More understanding.' It takes everything your sources collected and turns it into a short, ranked list of stories — the freshest and most relevant first — so you can skim what matters without wading through every feed.",
		},
		{
			type: "flow",
			title: "How a story reaches you",
			steps: [
				{ icon: "cloud_download", label: "Collect" },
				{ icon: "speed", label: "Rank" },
				{ icon: "auto_awesome", label: "Analyze" },
				{ icon: "menu_book", label: "Read" },
			],
		},
		{
			type: "paragraph",
			text: "Every story is scored 0–10 by a deterministic formula (source reliability × 0.6 + freshness × 2 + length signal, capped at 10). That score decides the order and the importance badge: Signal (highest), Trend, or Low-noise. The exact numbers behind each score are shown in the UI — see the Transparency section below for the full formula.",
		},
		{
			type: "features",
			items: [
				{
					icon: "sync",
					label: "Collect",
					text: "Pulls the latest articles from all enabled sources right now — no API key needed.",
				},
				{
					icon: "bolt",
					label: "Generate Brief",
					text: "Runs the AI period summary (Why It Matters / Impact / Takeaway) over the whole period.",
				},
				{
					icon: "tune",
					label: "Advanced search",
					text: "Opens the full researcher search with structured filters.",
				},
			],
		},
		{
			type: "features",
			items: [
				{
					icon: "calendar_month",
					label: "Period — Today / Week / Month / All",
					text: "Today is the start of the current day; Week is the last 7 days; Month the last 30; All has no cutoff.",
				},
				{
					icon: "sort",
					label: "Sort — Newest / Most relevant / Most important",
					text: "Newest is by publish date, Most relevant uses the engine ranking, Most important is strictly by score. The order changes, the set stays the same.",
				},
				{
					icon: "filter_list",
					label: "Domains — category chips",
					text: "AI, Security, Cloud, Backend, DevOps, Software Engineering, Web Development, Programming Languages, Open Source, Other. Click a chip to see only that domain.",
				},
				{
					icon: "translate",
					label: "Translate a story",
					text: "Stories that aren't fully translated yet offer a Translate action in the card's More menu — one click translates that story's title (and text, when the story has any) into your intelligence language. A story counts as fully translated when its title is translated and there is no body left to translate — so a legacy title-only translation and a story with a title but an empty description both still offer it. Once fully translated, the Original/Translated toggles take over. Collected stories also translate themselves: when a collect run pulls in new stories and an AI provider is configured, Vorynth automatically starts a translation job for them — in News mode (no API key) nothing is queued.",
				},
				{
					icon: "refresh",
					label: "Re-collect a story",
					text: "Every story has a Re-collect action in the card's More menu: it re-fetches that one story's original article, refreshes its full text, re-translates anything that went stale, and fills a missing AI analysis. When a stored translation is detected as incomplete (truncated or carrying leftover placeholders), a Re-translate action appears in its place — a broken translation always has an honest fix, never a dead end.",
				},
				{
					icon: "more_vert",
					label: "More menu",
					text: "The card footer stays clean — Read source · Article view · Save · More, with the source name at the far end. Article view is out in the open: a story with an AI analysis shows Insights view (Why It Matters / Impact / Takeaway — the default, the Brief is intelligence-first) and flips to the raw post — its real title and story text — with one click. The Translate/Re-translate and Re-collect actions live behind More, and a story without an analysis is always the article view.",
				},
				{
					icon: "sync",
					label: "Story actions run as jobs",
					text: "Translate, Re-translate, and Re-collect run as background jobs — the floating jobs tray (bottom-right) shows a live progress bar while one is running, and the card's More button spins until the story is done. Kick one off and navigate away freely; the engine finishes it and the Brief updates when you come back.",
				},
				{
					icon: "file_download",
					label: "Export the period brief",
					text: "The period briefing carries an Export button — download the headline, themes, takeaways, recommended actions, and cited sources as Markdown, a themed HTML page, or a screenshot.",
				},
			],
		},
		{
			type: "bullets",
			items: [
				"Each story card shows: rank, importance badge, domain, source name, age, and the headline.",
				"An Original/Translated toggle appears next to a story title and next to the story-text snippet when they were translated — and the reader carries one next to the full body too. An insight whose analysis was re-translated carries the same toggle on its detail page: Original shows the text as first written.",
				"Save (bookmark) keeps the story for later; 'Read source' opens the original article; Re-collect re-fetches the story's origin and repairs it.",
				"When intelligence mode is on, the card carries Why It Matters, Impact, and Takeaway.",
				"An insight page is the AI's analysis of one story (Why It Matters / Impact / Takeaway). The full story text lives on the separate Article page — a 'Read the full article' block sits right under the Takeaway, so it's always clear the insight is the analysis, not the article.",
				"Stories that aren't fully translated yet (title done AND no body left to translate) show a Translate pill next to the title — Settings → Translate Stories handles the whole collection in one job and only touches stories that still lack a translation.",
				"A story with no AI analysis yet explains why, honestly: in News mode it says the analysis needs an LLM provider; in Intelligence mode it offers a Generate button (one click analyzes just that story — and also translates it) — and a story with no body text says it can't be analyzed until the source is re-collected.",
			],
		},
		{
			type: "paragraph",
			text: "What it's for: fewer feeds, less noise. The Brief exists to end the ritual of opening ten tabs and skimming each one — you see the day's signal in one ranked list, and only dive into the stories that matter. The ranking is deterministic and transparent: the score and formula are shown, not hidden in a black box.",
		},
		{
			type: "paragraph",
			text: "The period briefing (Generate Brief) is written in your AI output language, and also keeps an ORIGINAL version in the majority language of its stories (or a language you pin in Settings → Summary original language). An Original/Translated toggle flips the headline, themes, and takeaways between the two, and the export includes both.",
		},
	],
};
