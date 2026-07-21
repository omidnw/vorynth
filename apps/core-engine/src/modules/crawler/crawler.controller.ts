import { Body, Controller, Inject, Param, Post } from "@nestjs/common";
import { CrawlerService } from "./crawler.service.js";

/**
 * Crawler endpoints.
 *
 *   POST /crawl/sources/:id   collect from one source
 *   POST /crawl/sources        collect from all enabled sources
 *
 * The frontend "Collect Now" button hits `POST /crawl/sources`.
 */
@Controller("crawl")
export class CrawlerController {
	constructor(
		@Inject(CrawlerService) private readonly crawler: CrawlerService,
	) {}

	@Post("sources/:id")
	async collectOne(@Param("id") id: string) {
		const collected = await this.crawler.collectSource(id);
		return { sourceId: id, collected: collected.length };
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
