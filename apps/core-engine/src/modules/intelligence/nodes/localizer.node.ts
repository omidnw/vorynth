import { Logger } from "@nestjs/common";
import type { LlmService } from "../../llm/llm.service.js";
import type {
	IntelligenceStateType,
	PipelineInsight,
} from "../state/intelligence-state.js";

/**
 * Localizer node factory (project-details.md §23 — multilingual pipeline).
 *
 * Sits AFTER the Analyzer. The Analyzer already asks the model to write in
 * `targetLanguage`, so for the slice this node is a refinement pass: it
 * re-checks each insight's prose and, when the source/target languages differ
 * significantly, asks the model to produce a cleaner localization that
 * preserves technical terminology.
 *
 * When no LLM is available this node is a no-op (the Analyzer never ran, so
 * there's nothing to localize).
 */
export function createLocalizerNode(llm: LlmService) {
	const logger = new Logger("Localizer");

	return async function localizer(
		state: IntelligenceStateType,
	): Promise<Partial<IntelligenceStateType>> {
		const targetLanguage = state.targetLanguage ?? "en";
		const incoming = state.insights ?? [];
		if (incoming.length === 0) return { insights: incoming };

		const available = await llm.isAvailable();
		if (!available) return { insights: incoming };

		// For the slice: keep it cheap. Only re-localize the top 3 insights.
		const toRefine = incoming.slice(0, 3);
		const tail = incoming.slice(3);

		const refined: PipelineInsight[] = [];
		for (const insight of toRefine) {
			try {
				const prompt = buildLocalizationPrompt(insight, targetLanguage);
				const draft = await llm.analyze({
					articleTitle: insight.summary,
					articleContent: prompt,
					outputLanguage: targetLanguage,
				});
				refined.push({
					...insight,
					summary: draft.summary || insight.summary,
					significance: draft.significance || insight.significance,
					impact: draft.impact || insight.impact,
					recommendedAction:
						draft.recommendedAction || insight.recommendedAction,
				});
			} catch (err) {
				logger.warn(`localize failed: ${(err as Error).message}`);
				refined.push(insight);
			}
		}

		// Preserve ranking (refined stay at the top because incoming was sorted).
		const all = [...refined, ...tail];
		return { insights: all };
	};
}

function buildLocalizationPrompt(
	insight: PipelineInsight,
	targetLanguage: string,
): string {
	return [
		"Refine this intelligence insight into clean, natural",
		`${languageName(targetLanguage)}. Preserve technical terms (library`,
		"names, CVE IDs, model names, acronyms) in their original form. Keep",
		"the structure and meaning intact; improve only phrasing.\n\n",
		`SUMMARY:\n${insight.summary}\n\n`,
		`WHY IT MATTERS:\n${insight.significance}\n\n`,
		`IMPACT:\n${insight.impact}\n\n`,
		`RECOMMENDED ACTION:\n${insight.recommendedAction}\n`,
	].join(" ");
}

function languageName(code: string): string {
	const names: Record<string, string> = {
		en: "English",
		fa: "Persian",
		es: "Spanish",
		de: "German",
		fr: "French",
		ja: "Japanese",
	};
	return names[code] ?? code;
}
