import {
	Controller,
	Get,
	Inject,
	NotFoundException,
	Param,
	Query,
} from "@nestjs/common";
import { NewsService, type BriefPeriod } from "./news.service.js";

/**
 * News endpoints.
 *
 *   GET /brief?limit=N&period=today   ranked news feed (no LLM required)
 *   GET /articles/:id                 one article + its source name (reader page)
 *
 * Always available. This is Vorynth's zero-configuration mode.
 * `period` ∈ today | week | month | all (default all).
 *
 * Note: the single-article endpoint lives on this controller under `/articles`
 * even though the feed is under `/brief` — both are news-layer reads and share
 * `NewsService`. NestJS lets one controller own multiple base paths via
 * per-method `@Get` absolutes.
 */
@Controller()
export class NewsController {
	constructor(@Inject(NewsService) private readonly news: NewsService) {}

	@Get("brief")
	async brief(
		@Query("limit") limit?: string,
		@Query("period") period?: string,
	) {
		const n = limit
			? Math.min(100, Math.max(1, Number.parseInt(limit, 10)))
			: 30;
		return this.news.buildBrief({
			limit: Number.isFinite(n) ? n : 30,
			period: (period as BriefPeriod) ?? "all",
		});
	}

	@Get("articles/:id")
	async article(@Param("id") id: string) {
		const detail = await this.news.getArticleDetail(id);
		if (!detail) {
			throw new NotFoundException(`Article ${id} not found`);
		}
		return detail;
	}
}
