import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	Patch,
	Post,
} from "@nestjs/common";
import { SourcesService } from "./sources.service.js";
import type { CreateSourceInput, UpdateSourceInput } from "@vorynth/types";

/**
 * Source management endpoints (project-details.md §29).
 *
 *   GET    /sources            list
 *   GET    /sources/:id        get one
 *   POST   /sources            create
 *   PATCH  /sources/:id        update enabled flag, fetchWindowDays, name, …
 *   DELETE /sources/:id        remove
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

	@Get(":id")
	async get(@Param("id") id: string) {
		return this.sources.get(id);
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
	async remove(@Param("id") id: string) {
		await this.sources.remove(id);
		return { id, removed: true };
	}
}
