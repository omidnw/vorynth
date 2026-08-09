import { buildTranslationPrompt } from "../../src/modules/intelligence/prompts/translation.prompt.js";
import { buildAnalyzePrompt } from "../../src/modules/llm/prompts/analyze.prompt.js";
import { parseDraft } from "../../src/modules/llm/providers/openai-provider.js";

/**
 * Bilingual output + technical-term convention (v1.8.0):
 *
 * 1. Every translation must render technical terms in the target language WITH
 *    the source-language term in parentheses on first mention (e.g. "کلودفلر
 *    (Cloudflare)") — not keep them untranslated.
 * 2. Insight generation is bilingual: when the story's source language differs
 *    from the user's language, ONE analyze request also returns the analysis
 *    in the source language (the insight's `original*` fields), so an insight
 *    always carries both versions for display and export.
 */

describe("translation prompt — technical-term convention", () => {
	it("asks for translated technical terms with the source term in parentheses", () => {
		const { system } = buildTranslationPrompt({
			targetLanguage: "fa",
			items: [{ id: "a", title: "T", content: "C" }],
		});
		expect(system).toContain("parentheses");
		expect(system).toContain("Cloudflare");
		expect(system).toContain("first mention");
	});
});

describe("analyze prompt — bilingual generation", () => {
	it("asks for the source-language version when the languages differ", () => {
		const { system, user } = buildAnalyzePrompt({
			articleTitle: "T",
			articleContent: "C",
			outputLanguage: "fa",
			sourceLanguage: "en",
		});
		expect(system).toContain("source language");
		expect(user).toContain('"originalSummary"');
		expect(user).toContain('"originalRecommendedAction"');
	});

	it("stays monolingual when the languages match", () => {
		const { user } = buildAnalyzePrompt({
			articleTitle: "T",
			articleContent: "C",
			outputLanguage: "en",
			sourceLanguage: "en",
		});
		expect(user).not.toContain('"originalSummary"');
	});
});

describe("parseDraft — source-language fields", () => {
	it("reads the bilingual original* fields", () => {
		const draft = parseDraft(
			JSON.stringify({
				summary: "S",
				significance: "G",
				impact: "I",
				recommendedAction: "R",
				importanceScore: 6,
				category: "ai",
				originalSummary: "EN S",
				originalSignificance: "EN G",
				originalImpact: "EN I",
				originalRecommendedAction: "EN R",
			}),
		);
		expect(draft.originalSummary).toBe("EN S");
		expect(draft.originalSignificance).toBe("EN G");
		expect(draft.originalImpact).toBe("EN I");
		expect(draft.originalRecommendedAction).toBe("EN R");
	});

	it("defaults missing originals to empty strings", () => {
		const draft = parseDraft(
			JSON.stringify({
				summary: "S",
				significance: "G",
				impact: "I",
				recommendedAction: "R",
				importanceScore: 3,
				category: "other",
			}),
		);
		expect(draft.originalSummary).toBe("");
	});
});
