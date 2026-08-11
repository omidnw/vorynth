import { buildTranslationPrompt } from "../../src/modules/intelligence/prompts/translation.prompt.js";
import { buildAnalyzePrompt } from "../../src/modules/llm/prompts/analyze.prompt.js";
import {
	localizeOriginalDraft,
	type InsightDraft,
} from "../../src/modules/llm/llm-provider.js";
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

	// v1.8.1 — an untagged source (no sourceLanguage) still gets a real
	// source-language original: the model DETECTS the article's language and
	// reports it back, so the engine can drop same-language "originals".
	it("auto-detects the source language when the source is untagged", () => {
		const { system, user } = buildAnalyzePrompt({
			articleTitle: "T",
			articleContent: "C",
			outputLanguage: "fa",
		});
		expect(system).toContain("detect it from the article text");
		expect(user).toContain('"sourceLanguage"');
		expect(user).toContain('"originalSummary"');
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

	it("reads the auto-detected sourceLanguage and normalizes its case", () => {
		const draft = parseDraft(
			JSON.stringify({
				summary: "S",
				significance: "G",
				impact: "I",
				recommendedAction: "R",
				importanceScore: 5,
				category: "ai",
				sourceLanguage: "EN",
				originalSummary: "EN S",
			}),
		);
		expect(draft.sourceLanguage).toBe("en");
		expect(draft.originalSummary).toBe("EN S");
	});
});

describe("localizeOriginalDraft (v1.8.1)", () => {
	const draft: InsightDraft = {
		summary: "S",
		significance: "G",
		impact: "I",
		recommendedAction: "R",
		importanceScore: 7,
		category: "ai",
		sourceLanguage: "en",
		originalSummary: "EN S",
		originalSignificance: "EN G",
		originalImpact: "EN I",
		originalRecommendedAction: "EN R",
	};

	it("keeps the originals when the detected source language differs from the output", () => {
		const out = localizeOriginalDraft(draft, "fa");
		expect(out.originalSummary).toBe("EN S");
		expect(out.sourceLanguage).toBe("en");
	});

	it("drops the originals when the article is already in the output language", () => {
		const out = localizeOriginalDraft(draft, "en");
		expect(out.originalSummary).toBeUndefined();
		expect(out.originalSignificance).toBeUndefined();
		expect(out.sourceLanguage).toBeUndefined();
	});

	it("drops empty originals (model returned nothing) even for a foreign source", () => {
		const out = localizeOriginalDraft(
			{
				...draft,
				originalSummary: "   ",
				originalImpact: "",
			},
			"fa",
		);
		expect(out.originalSummary).toBeUndefined();
		expect(out.originalImpact).toBeUndefined();
		// The non-empty originals survive.
		expect(out.originalSignificance).toBe("EN G");
	});

	it("leaves a tagged-source draft with no sourceLanguage untouched", () => {
		const tagged = { ...draft, sourceLanguage: undefined };
		const out = localizeOriginalDraft(tagged, "fa");
		expect(out.originalSummary).toBe("EN S");
	});
});
