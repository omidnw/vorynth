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
	/** User's domain interests, to bias ranking/explanation. */
	topics?: string[];
}

/**
 * Pre-localization draft. The engine then localizes + assigns the final
 * `importanceTier` based on the score before persisting an `Insight`.
 */
export interface InsightDraft {
	summary: string;
	significance: string;
	impact: string;
	recommendedAction: string;
	importanceScore: number; // 0..10
	category: string;
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
