import type { GenerateInput } from "../llm-provider.js";

/**
 * Free-form generation prompts (v1.1.0).
 *
 * Two operations use {@link LlmProvider.generate}:
 *   1. Behavior summary — turned from the user's search + brief history into a
 *      short prose profile of how they use Vorynth (what they search, what
 *      they read, what cadence). Surfaced on the Profile page.
 *   2. Improve custom instruction — rewrites the user's rough draft into a
 *      crisp, professional directive that biases future LLM outputs.
 *
 * Both return plain text (no JSON) so they work across every provider without
 * a parser. The user's existing custom instruction (if any) is folded into the
 * system message by {@link splitGeneratePrompt}, so an improved instruction
 * immediately shapes the next generate call.
 */

/**
 * Aggregated signals about how the user has used Vorynth. Computed by
 * `ProfileService` from `HistoryService.listSearch()` + `listBrief()`; this is
 * the data the summary is generated FROM (we never send raw history rows).
 */
export interface BehaviorStats {
	totalSearches: number;
	keywordSearches: number;
	aiSearches: number;
	totalBriefs: number;
	/** Top search queries, most frequent first (already truncated). */
	topQueries: string[];
	/** Category → count, derived from brief themes + source categories. */
	topCategories: { name: string; count: number }[];
	/** Days between first and last history entry (0 when only one entry). */
	activeSpanDays: number;
}

/** Render the behavior-summary prompt pair. */
export function buildBehaviorSummaryPrompt(
	stats: BehaviorStats,
	ctx: { outputLanguage: string; customInstruction?: string },
): GenerateInput {
	const system = [
		"You are Vorynth, a personal intelligence engine.",
		"You are writing a private, first-person-friendly behavior profile of the user",
		"based ONLY on how they have used this app — never speculate beyond the data.",
		"Describe what they tend to search for, which topics dominate, how they split",
		"between keyword and AI search, and how often they read briefings.",
		"Be concrete and specific; cite the actual top queries. 3-5 sentences. No lists.",
		"No flattery, no marketing. Write as a neutral observer taking notes.",
	].join(" ");

	const lines = [
		"USER ACTIVITY (aggregated, no raw rows):",
		`- Total searches: ${stats.totalSearches} (keyword ${stats.keywordSearches}, AI ${stats.aiSearches})`,
		`- Briefings viewed/generated: ${stats.totalBriefs}`,
		`- Active span: ${stats.activeSpanDays} day(s)`,
	];
	if (stats.topQueries.length > 0) {
		lines.push(
			`- Top queries: ${stats.topQueries.map((q) => `"${q}"`).join(", ")}`,
		);
	}
	if (stats.topCategories.length > 0) {
		lines.push(
			`- Top categories: ${stats.topCategories
				.map((c) => `${c.name} (${c.count})`)
				.join(", ")}`,
		);
	}
	if (stats.totalSearches === 0 && stats.totalBriefs === 0) {
		lines.push(
			"(Note: there is almost no activity yet — say so plainly and suggest they start searching or reading briefings.)",
		);
	}

	return {
		system,
		user: lines.join("\n"),
		outputLanguage: ctx.outputLanguage,
		customInstruction: ctx.customInstruction,
	};
}

/** Render the improve-instruction prompt pair. */
export function buildImproveInstructionPrompt(
	rawText: string,
	ctx: { outputLanguage: string; customInstruction?: string },
): GenerateInput {
	const system = [
		"You are Vorynth, a personal intelligence engine.",
		"The user wrote a rough custom instruction that will bias how the app's AI",
		"responds to them. Rewrite it into a single crisp, professional directive —",
		"2-4 sentences max. Preserve every concrete preference they stated (tone,",
		"depth, language, format, what to avoid). Remove filler, repetition, and",
		"hedge words. Keep it actionable: a future LLM call should be able to follow it.",
		"Do not invent preferences the user did not express.",
	].join(" ");

	const user = [
		"USER'S ROUGH DRAFT:",
		"---",
		rawText.slice(0, 4000),
		"---",
		"",
		"Return ONLY the improved instruction text. No preamble, no quotes, no labels.",
	].join("\n");

	return {
		system,
		user,
		outputLanguage: ctx.outputLanguage,
		customInstruction: ctx.customInstruction,
	};
}
