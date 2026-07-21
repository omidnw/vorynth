import { Annotation } from "@langchain/langgraph";
import type { Article, ImportanceTier, SourceCategory } from "@vorynth/types";

/**
 * Pipeline state (project-details.md §25 / §26).
 *
 * Carries the raw collected articles through the workflow and accumulates
 * the structured intelligence that ends up persisted as `Insight` rows.
 * Mirrors the LangGraph starter's `Annotation.Root` pattern.
 */
export interface PipelineArticle {
	article: Article;
	clusterId: string;
	score: number;
}

export interface PipelineInsight {
	articleId: string;
	clusterId: string;
	summary: string;
	significance: string;
	impact: string;
	recommendedAction: string;
	importanceScore: number;
	importanceTier: ImportanceTier;
	category: SourceCategory;
}

export const IntelligenceState = Annotation.Root({
	/** Run id (used for SSE streaming + checkpointer thread). */
	runId: Annotation<string>,
	/** Output language, independent of source language (§22). */
	targetLanguage: Annotation<string>,
	/** User interests to bias ranking/explanation. */
	topics: Annotation<string[]>,
	/** Articles entering the pipeline (after collection). */
	articles: Annotation<Article[]>,
	/** Scored + clustered mid-pipeline. */
	pipeline: Annotation<PipelineArticle[]>,
	/** Final insights, ready to persist. */
	insights: Annotation<PipelineInsight[]>,
	/** Total stories seen at collection (for the Brief header). */
	totalSeen: Annotation<number>,
});

export type IntelligenceStateType = typeof IntelligenceState.State;
