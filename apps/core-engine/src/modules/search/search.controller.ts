import { Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { SearchService } from "./search.service.js";

/**
 * Search endpoints.
 *
 *   GET  /search?q=…          keyword search (no LLM)
 *   POST /search/ask?q=…      AI-assisted search (RAG, rate-limited)
 *
 * Both accept `periodDays` to scope by collected time.
 */
@Controller("search")
export class SearchController {
	constructor(@Inject(SearchService) private readonly search: SearchService) {}

	@Get()
	async keyword(
		@Query("q") q: string,
		@Query("limit") limit?: string,
		@Query("periodDays") periodDays?: string,
	) {
		const periodMs = periodDays ? Number(periodDays) * 86_400_000 : undefined;
		return this.search.keyword(q ?? "", {
			limit: limit ? Number(limit) : 20,
			periodMs,
		});
	}

	@Post("ask")
	async ask(
		@Query("q") q: string,
		@Query("periodDays") periodDays?: string,
		@Query("budget") budget?: string,
	) {
		const periodMs = periodDays ? Number(periodDays) * 86_400_000 : undefined;
		return this.search.ask(q ?? "", {
			periodMs,
			contextTokenBudget: budget ? Number(budget) : undefined,
		});
	}
}
