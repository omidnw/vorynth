import { randomUUID } from "node:crypto";
import type { SourceCategory } from "@vorynth/types";
import type {
	IntelligenceStateType,
	PipelineArticle,
} from "../state/intelligence-state.js";

/**
 * Classifier + Ranker node factory.
 *
 * For the vertical slice we don't run a separate LLM classification pass —
 * category is taken from the source each article came from (passed in via
 * `categoryByArticle`), and the initial score is a cheap deterministic
 * heuristic:
 *
 *   ImportanceScore = SourceReliability + Freshness + LengthSignal
 *
 * The Analyzer node later replaces this score with the LLM's own. This keeps
 * the pipeline cheap enough to run end-to-end even without an API key (so the
 * UI has data to render in dev).
 */
const SOURCE_RELIABILITY: Record<string, number> = {
	ai: 7,
	security: 8,
	"software-engineering": 6,
	cloud: 5,
	devops: 5,
	backend: 4,
	"web-development": 4,
	"programming-languages": 5,
	"open-source": 5,
	other: 3,
};

export function createRankerNode(
	categoryByArticle: Map<string, SourceCategory>,
) {
	return async function ranker(
		state: IntelligenceStateType,
	): Promise<Partial<IntelligenceStateType>> {
		const now = Date.now();
		const articles = state.articles ?? [];
		const topics = new Set(state.topics ?? []);

		const pipeline: PipelineArticle[] = articles.map((a) => {
			const category = categoryByArticle.get(a.id) ?? "other";
			const reliability = SOURCE_RELIABILITY[category] ?? 3;
			const freshness = freshnessScore(a, now);
			const lengthSignal = Math.min(2, (a.content?.length ?? 0) / 2000);
			const topicBoost = topics.has(category) ? 1.5 : 0;
			const score = Math.min(
				10,
				reliability * 0.6 + freshness * 2 + lengthSignal + topicBoost,
			);
			return { article: a, clusterId: randomUUID(), score };
		});

		pipeline.sort((x, y) => y.score - x.score);
		return { pipeline };
	};
}

function freshnessScore(a: { publishedAt?: Date | null }, now: number): number {
	if (!a.publishedAt) return 0.5;
	const ageHours = (now - a.publishedAt.getTime()) / 3_600_000;
	if (ageHours < 6) return 2;
	if (ageHours < 24) return 1.5;
	if (ageHours < 72) return 1;
	if (ageHours < 168) return 0.5;
	return 0.1;
}
