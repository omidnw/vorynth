import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import { SourcesService } from "./sources.service.js";
import type {
	BulkSourceEnableInput,
	CreateSourceInput,
	SourceRange,
	UpdateSourceInput,
	VerifySourceInput,
} from "@vorynth/types";

/**
 * Source management endpoints (project-details.md §29).
 *
 *   GET    /sources                       list
 *   GET    /sources/:id                   get one
 *   GET    /sources/:id/articles          articles within a range window
 *   POST   /sources                       create
 *   POST   /sources/verify                dry-run a config (Test button, v1.8.0)
 *   POST   /sources/bulk-enabled          bulk enable/disable a group (v1.8.0)
 *   PATCH  /sources/:id                   update enabled flag, fetchWindowDays, name, …
 *   DELETE /sources/:id                   remove (409 when bookmarked articles
 *                                         exist; `?force=true` confirms)
 */
@Controller("sources")
export class SourcesController {
	constructor(
		@Inject(SourcesService) private readonly sources: SourcesService,
	) {}

	@Get()
	async list() {
		return this.sources.list();
	}

	/** v1.8.0 — dry-run a source config without saving (Add form "Test"). */
	@Post("verify")
	async verify(@Body() body: VerifySourceInput) {
		return this.sources.verify(body);
	}

	/** v1.8.0 — bulk enable/disable every source in a category/country/city/language group. */
	@Post("bulk-enabled")
	async bulkEnabled(@Body() body: BulkSourceEnableInput) {
		return this.sources.bulkEnable(body);
	}

	@Get(":id")
	async get(@Param("id") id: string) {
		return this.sources.get(id);
	}

	@Get(":id/articles")
	async articlesInRange(
		@Param("id") id: string,
		@Query("range") range?: string,
		@Query("from") from?: string,
		@Query("to") to?: string,
	) {
		return this.sources.articlesInRange(id, {
			range: (range as SourceRange) || undefined,
			from,
			to,
		});
	}

	@Post()
	async create(@Body() input: CreateSourceInput) {
		return this.sources.create(input);
	}

	@Patch(":id")
	async patch(@Param("id") id: string, @Body() body: UpdateSourceInput) {
		return this.sources.update(id, body);
	}

	@Delete(":id")
	async remove(@Param("id") id: string, @Query("force") force?: string) {
		await this.sources.remove(id, force === "true");
		return { id, removed: true };
	}
}
