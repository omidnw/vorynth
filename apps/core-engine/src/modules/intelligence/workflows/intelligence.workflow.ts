import { END, START, StateGraph } from "@langchain/langgraph";
import type { Article, SourceCategory } from "@vorynth/types";
import { IntelligenceState } from "../state/intelligence-state.js";
import { createCollectorNode } from "../nodes/collector.node.js";
import { normalizer } from "../nodes/normalizer.node.js";
import { createRankerNode } from "../nodes/ranker.node.js";
import { createAnalyzerNode } from "../nodes/analyzer.node.js";
import { createLocalizerNode } from "../nodes/localizer.node.js";
import type { LlmService } from "../../llm/llm.service.js";

/**
 * Intelligence workflow factory.
 *
 *   Collector → Normalizer → Ranker → Analyzer → Localizer → END
 *
 * Mirrors the LangGraph starter layout: build a `StateGraph` over the
 * `IntelligenceState` annotation, add nodes, wire edges, compile. The
 * Localizer is a refinement pass that only runs when an LLM is configured.
 */
export function buildIntelligenceGraph(opts: {
	loadArticles: () => Promise<Article[]>;
	categoryByArticle: Map<string, SourceCategory>;
	llm: LlmService;
	analyzeCap?: number;
}) {
	const collector = createCollectorNode(opts.loadArticles);
	const ranker = createRankerNode(opts.categoryByArticle);
	const analyzer = createAnalyzerNode(opts.llm, opts.analyzeCap);
	const localizer = createLocalizerNode(opts.llm);

	const workflow = new StateGraph(IntelligenceState)
		.addNode("collector", collector)
		.addNode("normalizer", normalizer)
		.addNode("ranker", ranker)
		.addNode("analyzer", analyzer)
		.addNode("localizer", localizer)
		.addEdge(START, "collector")
		.addEdge("collector", "normalizer")
		.addEdge("normalizer", "ranker")
		.addEdge("ranker", "analyzer")
		.addEdge("analyzer", "localizer")
		.addEdge("localizer", END);

	return workflow.compile();
}

export type IntelligenceGraph = ReturnType<typeof buildIntelligenceGraph>;
