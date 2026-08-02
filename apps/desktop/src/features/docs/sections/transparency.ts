import type { DocsSection } from "../types.js";

/**
 * Transparency sections — the 'why' behind Vorynth's decisions (v1.6.0).
 * Stored signals and real formulas, never invented explanations.
 */
export const transparencySections: DocsSection[] = [
	{
		id: "transparency-collection",
		title: "How data is collected",
		summary: "Where stories come from and what happens to them.",
		icon: "cloud_download",
		blocks: [
			{
				type: "paragraph",
				text: "Sources are fetched by adapters (RSS feeds, GitHub releases, arXiv). Each fetched item is parsed into a story with a title, description/content, URL, and author (when the source provides one), then deduplicated by a content hash so the same story isn't stored twice.",
			},
			{
				type: "paragraph",
				text: "Titles and descriptions come straight from the source — Vorynth doesn't rewrite them. If a title or body looks different from the article you open, it's usually the source's own summary or a translation (Translate Stories keeps the original title and body one toggle away — the original is never overwritten).",
			},
		],
	},
	{
		id: "transparency-ranking",
		title: "How importance is decided",
		summary: "The exact, deterministic formula — no black box.",
		icon: "speed",
		blocks: [
			{
				type: "flow",
				title: "The score formula",
				steps: [
					{ icon: "verified_user", label: "Reliability × 0.6" },
					{ icon: "schedule", label: "Freshness × 2" },
					{ icon: "notes", label: "Length signal" },
					{ icon: "equal", label: "Cap at 10" },
				],
			},
			{
				type: "paragraph",
				text: "Every story gets a 0–10 score from three stored signals: source reliability by category (a fixed table, e.g. security 8, AI 7, backend 4), freshness (newer scores higher), and content length (a small signal). The formula: reliability × 0.6 + freshness × 2 + length, capped at 10.",
			},
			{
				type: "paragraph",
				text: "Importance tiers (Signal / Trend / Low-noise) are derived from that score. In Intelligence mode the LLM can override the tier with its own judgment — but the stored signals are always shown in the UI, so you can see exactly why something ranked the way it did.",
			},
		],
	},
	{
		id: "transparency-ask",
		title: "How Ask AI works",
		summary: "Answers come from your own collected articles, cited.",
		icon: "auto_awesome",
		blocks: [
			{
				type: "paragraph",
				text: "Ask AI is retrieval-augmented: it runs a keyword search over YOUR collected articles, packs the top matches into a context window, and instructs the model to answer using only that context, emitting [N] citations. Every claim in the answer points back to an article you can open.",
			},
			{
				type: "paragraph",
				text: "If the model cites something that isn't in the context, the citation is dropped — Vorynth never fabricates sources.",
			},
		],
	},
	{
		id: "transparency-brief",
		title: "How the Brief summary works",
		summary: "One cohesive briefing, built from real stories.",
		icon: "bolt",
		blocks: [
			{
				type: "flow",
				title: "From stories to a briefing",
				steps: [
					{ icon: "inventory_2", label: "Gather top stories" },
					{ icon: "auto_awesome", label: "Ask the LLM" },
					{ icon: "format_quote", label: "Cite [N]" },
					{ icon: "history", label: "Cache in History" },
				],
			},
			{
				type: "paragraph",
				text: "The period summary (Today / Week / Month) gathers the top stories, packs them with their citations, and asks the LLM for a headline, themes, takeaways, and recommended actions — each referencing [N] stories. The full summary is cached in History so you can revisit it without regenerating.",
			},
			{
				type: "paragraph",
				text: "In News mode (no provider) the Brief is simply the ranked story list — no LLM involved.",
			},
		],
	},
];
