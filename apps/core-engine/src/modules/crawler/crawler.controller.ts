import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { CrawlerService } from "./crawler.service.js";

/**
 * Crawler endpoints.
 *
 *   POST /crawl/sources/:id   collect from one source
 *   POST /crawl/sources        collect from all enabled sources
 *
 * The frontend "Collect Now" button hits `POST /crawl/sources`. A `force`
 * body flag re-processes items that already exist (content refresh — used to
 * repair stored content after extraction fixes), not just new ones.
 */
@Controller("crawl")
export class CrawlerController {
	constructor(
		@Inject(CrawlerService) private readonly crawler: CrawlerService,
	) {}

	@Post("sources/:id")
	async collectOne(@Param("id") id: string, @Body() body: { force?: boolean }) {
		const force = Boolean(body?.force);
		const collected = await this.crawler.collectSource(id, { force });
		return { sourceId: id, collected: collected.length, force };
	}

	@Post("sources")
	async collectAll(@Body() _body: unknown) {
		const results = await this.crawler.collectAll();
		return {
			sources: results.length,
			totalCollected: results.reduce((sum, r) => sum + r.collected, 0),
			results,
		};
	}
}
