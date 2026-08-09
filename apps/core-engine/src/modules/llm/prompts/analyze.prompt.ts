import type { AnalyzeInput } from "../llm-provider.js";

/**
 * The Analyzer prompt (project-details.md §26).
 *
 * Vorynth's whole thesis is "explain, don't just summarize." This prompt is
 * the same for every LLM provider so the output structure is identical
 * regardless of model. The LangGraph Analyzer node renders it and parses the
 * JSON it asks for.
 */
export function buildAnalyzePrompt(input: AnalyzeInput): {
	system: string;
	user: string;
} {
	// v1.8.0 — bilingual generation: when the story's source language differs
	// from the user's language, the same request also returns the analysis in
	// the source language (stored as the insight's `original*` fields), so an
	// insight always has both versions for bilingual display and export.
	const bilingual =
		input.sourceLanguage &&
		input.sourceLanguage.toLowerCase() !== input.outputLanguage.toLowerCase();

	const system = [
		"You are Vorynth, a personal intelligence engine.",
		"Your job is to distill a single article into a structured intelligence insight.",
		"You do NOT summarize — you explain what happened, why it matters, the impact,",
		"and the concrete action a technical professional should take.",
		"Be precise, terse, and technical. No marketing language. No hedging.",
		`Write every human-readable field in: ${input.outputLanguage}.`,
		"Technical terms and proper names (library names, CVE IDs, model names, tool",
		"and product names) are translated into that language, with the source term",
		"kept in parentheses on first mention, e.g. \u201C\u06A9\u0644\u0627\u0648\u062F\u0641\u0644\u0631 (Cloudflare)\u201D.",
		...(bilingual
			? [
					`Also write the ENTIRE analysis again in the story's source language: ${input.sourceLanguage}.`,
				]
			: []),
	].join(" ");

	const user = [
		`TITLE: ${input.articleTitle}`,
		"",
		"CONTENT:",
		input.articleContent.slice(0, 12_000),
		"",
		"Return ONLY a JSON object with this exact shape, no prose, no code fences:",
		"{",
		'  "summary": "one-sentence statement of what happened (archival, declarative)",',
		'  "significance": "why it matters — 1-2 sentences",',
		'  "impact": "concrete consequence / blast radius — 1 sentence",',
		'  "recommendedAction": "the single most useful next step the reader should take",',
		'  "importanceScore": <number 0-10, higher = more strategically important>,',
		'  "category": "one of: ai | software-engineering | programming-languages | web-development | backend | devops | cloud | security | open-source | other"',
		...(bilingual
			? [
					'  "originalSummary": "summary written in the source language",',
					'  "originalSignificance": "significance written in the source language",',
					'  "originalImpact": "impact written in the source language",',
					'  "originalRecommendedAction": "recommended action written in the source language"',
				]
			: []),
		"}",
	].join("\n");

	return { system, user };
}
