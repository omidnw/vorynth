import type { Article } from "@vorynth/types";
import type { IntelligenceStateType } from "../state/intelligence-state.js";

/**
 * Collector node factory.
 *
 * Pulls the freshly-collected articles into the pipeline state. In a real run
 * the articles are already in the DB (collected via `CrawlerService` before
 * the workflow is invoked); this node is the entry point that loads them and
 * seeds `totalSeen`.
 */
export function createCollectorNode(loadArticles: () => Promise<Article[]>) {
	return async function collector(
		_state: IntelligenceStateType,
	): Promise<Partial<IntelligenceStateType>> {
		const articles = await loadArticles();
		return {
			articles,
			pipeline: [],
			insights: [],
			totalSeen: articles.length,
		};
	};
}
