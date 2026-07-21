import { Logger } from "@nestjs/common";
import type { SourceCategory } from "@vorynth/types";
import type { LlmService } from "../../llm/llm.service.js";
import type {
	IntelligenceStateType,
	PipelineInsight,
} from "../state/intelligence-state.js";
import { tierFor } from "./tier.js";

/**
 * Analyzer node factory.
 *
 * The intelligence heart of Vorynth (project-details.md §26): for each article
 * in the pipeline, generate the structured insight
 * (summary / why it matters / impact / recommended action / score) via the
 * configured LLM provider.
 *
 * This node is ONLY invoked by `IntelligenceService.generate` when an LLM
 * provider is configured. With no key, the app stays in news-reader mode
 * (NewsService alone) and this node never runs — no fake "pending" insights.
 */
export function createAnalyzerNode(llm: LlmService, cap = 10) {
	const logger = new Logger("Analyzer");

	return async function analyzer(
		state: IntelligenceStateType,
	): Promise<Partial<IntelligenceStateType>> {
		const targetLanguage = state.targetLanguage ?? "en";
		const topics = state.topics ?? [];
		const pipeline = state.pipeline ?? [];

		// Cap how many we analyze to keep a single run cheap.
		const selected = pipeline.slice(0, cap);
		const insights: PipelineInsight[] = [];

		for (const item of selected) {
			const a = item.article;
			try {
				const draft = await llm.analyze({
					articleTitle: a.title,
					articleContent: a.content,
					outputLanguage: targetLanguage,
					topics,
				});
				insights.push({
					articleId: a.id,
					clusterId: item.clusterId,
					summary: draft.summary,
					significance: draft.significance,
					impact: draft.impact,
					recommendedAction: draft.recommendedAction,
					importanceScore: draft.importanceScore || item.score,
					importanceTier: tierFor(draft.importanceScore || item.score),
					category: (draft.category as SourceCategory) || "other",
				});
			} catch (err) {
				// Per-item failure: log and skip. Other items still get analyzed.
				logger.warn(
					`analyze failed for "${a.title}": ${(err as Error).message}`,
				);
			}
		}

		insights.sort((x, y) => y.importanceScore - x.importanceScore);
		return { insights };
	};
}
