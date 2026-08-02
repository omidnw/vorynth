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
					text: "Runs the AI period summary (Why It Matters / Impact / Recommended Action) over the whole period.",
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
			],
		},
		{
			type: "bullets",
			items: [
				"Each story card shows: rank, importance badge, domain, source name, age, and the headline.",
				"An Original/Translated toggle appears next to a story title and next to the story-text snippet when they were translated — and the reader carries one next to the full body too.",
				"Save (bookmark) keeps the story for later; 'Read source' opens the original article.",
				"When intelligence mode is on, the card carries Why It Matters, Impact, and Recommended Action.",
			],
		},
		{
			type: "paragraph",
			text: "What it's for: fewer feeds, less noise. The Brief exists to end the ritual of opening ten tabs and skimming each one — you see the day's signal in one ranked list, and only dive into the stories that matter. The ranking is deterministic and transparent: the score and formula are shown, not hidden in a black box.",
		},
	],
};
