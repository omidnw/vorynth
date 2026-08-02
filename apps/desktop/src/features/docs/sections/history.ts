import type { DocsSection } from "../types.js";

/** History — every past search, briefing, and generation. */
export const historySection: DocsSection = {
	id: "history",
	title: "History",
	summary: "Every past search, briefing, and generation — revisitable.",
	icon: "history",
	pageRoute: "/archive",
	blocks: [
		{
			type: "paragraph",
			text: "The History drawer (top-bar clock icon) groups your saved searches, briefings, and generated summaries — three scopes that switch automatically based on the page you're on (briefings on the Brief, generated on Profile, searches elsewhere).",
		},
		{
			type: "paragraph",
			text: "Why history: intelligence you don't keep is intelligence you have to regenerate. Every search, briefing, and generation is cached and revisitable — a past Ask-AI answer opens without re-running the model, so insights stay available long after the moment they were produced.",
		},
		{
			type: "bullets",
			items: [
				"Each entry opens its full cached result — past Ask-AI answers are viewable without re-running the model.",
				"Entries can be renamed, archived, or deleted (bulk actions available in select mode), with themed confirmation dialogs.",
				"History rows also appear in the Archive as items (summaries, searches, AI asks), so you can tag, note, and organize them like anything else.",
			],
		},
	],
};
