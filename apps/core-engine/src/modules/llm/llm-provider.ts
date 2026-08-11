export type LlmProviderKind = "gemini" | "openai" | "anthropic" | "ollama";

/** Settings a concrete provider needs to be constructed. */
export interface ProviderConstructorOpts {
	apiKey?: string;
	model?: string;
	baseUrl?: string;
}

/**
 * LLM provider abstraction (project-details.md §24).
 *
 * Vorynth must not depend on a single AI provider — every provider
 * (Gemini, OpenAI, Anthropic, Ollama) implements this interface. The Analyzer
 * node calls whichever provider the user has configured.
 */
export interface LlmProvider {
	readonly kind: LlmProviderKind;

	/** Quick reachability check used by onboarding "verify connection". */
	verify(): Promise<boolean>;

	/**
	 * Generate an intelligence insight for one article's content.
	 *
	 * The prompt shape is fixed by Vorynth (summary / why it matters / impact /
	 * importance / recommended action) so every provider returns the same
	 * structure regardless of model quirks.
	 */
	analyze(input: AnalyzeInput): Promise<InsightDraft>;

	/**
	 * Free-form text generation (v1.1.0). Used by the Profile page to produce a
	 * behavior summary from history and to improve the user's custom
	 * instruction draft. Returns the raw model text — no JSON parsing, no fixed
	 * shape. Same rate-limiting and usage recording as `analyze`.
	 */
	generate(input: GenerateInput): Promise<string>;
}

export interface AnalyzeInput {
	articleContent: string;
	articleTitle: string;
	/** Language the insight must be generated in (independent of source). */
	outputLanguage: string;
	/**
	 * v1.8.0 — the story's source language. When it differs from
	 * `outputLanguage`, the SAME request also returns the analysis in that
	 * language (the insight's `original*` fields), so every insight carries
	 * both versions for bilingual display/export.
	 */
	sourceLanguage?: string;
	/** User's domain interests, to bias ranking/explanation. */
	topics?: string[];
}

/**
 * Pre-localization draft. The engine then localizes + assigns the final
 * `importanceTier` based on the score before persisting an `Insight`.
 * `original*` (v1.8.0) is the same analysis in the story's source language,
 * present when the source language differs from the output language.
 */
export interface InsightDraft {
	summary: string;
	significance: string;
	impact: string;
	recommendedAction: string;
	importanceScore: number; // 0..10
	category: string;
	originalSummary?: string;
	originalSignificance?: string;
	originalImpact?: string;
	originalRecommendedAction?: string;
	/**
	 * v1.8.1 — the source language the model detected when the story's source
	 * was UNTAGGED (auto-detect bilingual generation). Lets the engine drop the
	 * "original" when the article is already in the output language, so the UI
	 * never shows a misleading Original toggle for same-language content.
	 */
	sourceLanguage?: string;
}

/**
 * v1.8.1 — normalize a draft's bilingual originals against the output language.
 * With auto-detection (untagged sources) the model reports the detected source
 * language: when the article is already in the output language the "original"
 * would be the same language — drop it. Empty originals (the model returned
 * nothing) are dropped too. Returns the draft with those fields cleared.
 */
export function localizeOriginalDraft(
	draft: InsightDraft,
	outputLanguage: string,
): InsightDraft {
	const sameLang = Boolean(
		draft.sourceLanguage &&
		draft.sourceLanguage.toLowerCase() === outputLanguage.toLowerCase(),
	);
	const keep = (s: string | undefined): string | undefined =>
		s && s.trim() ? s : undefined;
	return {
		...draft,
		sourceLanguage: sameLang ? undefined : draft.sourceLanguage,
		originalSummary: sameLang ? undefined : keep(draft.originalSummary),
		originalSignificance: sameLang
			? undefined
			: keep(draft.originalSignificance),
		originalImpact: sameLang ? undefined : keep(draft.originalImpact),
		originalRecommendedAction: sameLang
			? undefined
			: keep(draft.originalRecommendedAction),
	};
}

/**
 * Input for free-form {@link LlmProvider.generate}. The prompt is split into a
 * system instruction and a user message so providers can map them onto their
 * native chat roles. `outputLanguage` is the BCP-47 code the response must be
 * written in; `customInstruction` (when present) is the user's profile
 * directive that should bias the tone/shape of the output.
 */
export interface GenerateInput {
	system: string;
	user: string;
	outputLanguage: string;
	customInstruction?: string;
}
