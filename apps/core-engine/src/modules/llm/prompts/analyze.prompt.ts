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
	const system = [
		"You are Vorynth, a personal intelligence engine.",
		"Your job is to distill a single article into a structured intelligence insight.",
		"You do NOT summarize — you explain what happened, why it matters, the impact,",
		"and the concrete action a technical professional should take.",
		"Be precise, terse, and technical. No marketing language. No hedging.",
		`Write every human-readable field in: ${input.outputLanguage}.`,
		"Technical terms (library names, CVE IDs, model names) stay in their original form.",
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
		"}",
	].join("\n");

	return { system, user };
}
