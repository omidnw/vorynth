import { Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { SearchService } from "./search.service.js";
import type { AdvancedSearchQuery } from "@vorynth/types";

/**
 * Search endpoints.
 *
 *   GET  /search?q=…&author=…    keyword search (no LLM), optional author filter
 *   POST /search/ask?q=…          AI-assisted search (RAG, rate-limited)
 *   GET  /search/advanced         structured researcher search (v1.6.0)
 *
 * `periodDays` scopes by collected time; the advanced endpoint takes the
 * structured filters from `AdvancedSearchQuery` (comma-separated lists).
 */
@Controller("search")
export class SearchController {
	constructor(@Inject(SearchService) private readonly search: SearchService) {}

	@Get()
	async keyword(
		@Query("q") q: string,
		@Query("limit") limit?: string,
		@Query("periodDays") periodDays?: string,
		@Query("author") author?: string,
	) {
		const periodMs = periodDays ? Number(periodDays) * 86_400_000 : undefined;
		return this.search.keyword(q ?? "", {
			limit: limit ? Number(limit) : 20,
			periodMs,
			author: author || undefined,
		});
	}

	@Get("advanced")
	async advanced(
		@Query("q") q?: string,
		@Query("domains") domains?: string,
		@Query("importance") importance?: string,
		@Query("from") from?: string,
		@Query("to") to?: string,
		@Query("authors") authors?: string,
		@Query("sources") sources?: string,
		@Query("hasInsight") hasInsight?: string,
		@Query("limit") limit?: string,
	) {
		const split = (s?: string) =>
			s
				?.split(",")
				.map((x) => x.trim())
				.filter(Boolean);
		const query: AdvancedSearchQuery = {
			q: q || undefined,
			domains: split(domains) as AdvancedSearchQuery["domains"],
			importance: split(importance) as AdvancedSearchQuery["importance"],
			from: from || undefined,
			to: to || undefined,
			authors: split(authors),
			sources: split(sources),
			hasInsight: hasInsight === "true" ? true : undefined,
			limit: limit ? Number(limit) : undefined,
		};
		return this.search.advanced(query);
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
