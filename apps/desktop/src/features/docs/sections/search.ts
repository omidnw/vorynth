import type { DocsSection } from "../types.js";

/** Search & Ask AI — keyword, RAG answers with citations, and researcher filters. */
export const searchSection: DocsSection = {
	id: "search",
	title: "Search & Ask AI",
	summary: "Find anything, or ask the AI to find it for you.",
	icon: "search",
	pageRoute: "/archive/search",
	blocks: [
		{
			type: "paragraph",
			text: "Search lives on its own page under the Archive (/archive/search). It has two modes plus an advanced panel.",
		},
		{
			type: "features",
			items: [
				{ icon: "search", label: "Keyword", text: "Runs instantly over every collected article via a full-text index (titles, content, and now authors). Results rank by relevance with highlighted snippets." },
				{ icon: "auto_awesome", label: "Ask AI (RAG)", text: "Pulls the top matching articles, packs them into a context window, and asks the LLM to answer using only that ground truth — with numbered [N] citations. Runs as a background job (5 req/min); in News mode it falls back to keyword." },
				{ icon: "tune", label: "Advanced", text: "For researchers: combine keywords, domains, importance tiers, a specific source, a collected-date range, and a 'has AI analysis' filter. Deterministic, no LLM." },
			],
		},
		{
			type: "flow",
			title: "How Ask AI builds an answer",
			steps: [
				{ icon: "search", label: "Search" },
				{ icon: "inventory_2", label: "Collect context" },
				{ icon: "auto_awesome", label: "Ask LLM" },
				{ icon: "format_quote", label: "Cite [N]" },
			],
		},
		{
			type: "bullets",
			items: [
				"Every search is recorded in History (Ask AI always; keyword is opt-in in Settings).",
				"The 'View full result' button opens the full cached result page.",
			],
		},
		{
			type: "paragraph",
			text: "What it's for: finding what you've collected without remembering where it came from. Keyword search is instant and offline — your archive is local. Ask AI goes further: it answers from the actual collected articles and cites them [N], so the AI never fabricates — if it can't support a claim from your data, it won't invent it.",
		},
	],
};
