import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	Post,
	Query,
} from "@nestjs/common";
import { SourceListsService } from "./source-lists.service.js";

/**
 * Source list endpoints (v1.8.0).
 *
 *   GET    /source-lists              every curated list (official + community)
 *   GET    /source-lists/:id/sources  a list's sites for the preview modal (v1.8.1)
 *   POST   /source-lists/import       import a source-list file (my-sources.json)
 *   POST   /source-lists/:id/enable   turn a list on (materializes its sources)
 *   POST   /source-lists/:id/disable  hide a list (nothing deleted)
 *   POST   /source-lists/:id/update   update one downloaded list from the repo (v1.8.1)
 *   DELETE /source-lists/:id          permanently delete a list (v1.8.1)
 *   POST   /source-lists/refresh      sync the community catalog from GitHub
 */
@Controller("source-lists")
export class SourceListsController {
	constructor(
		@Inject(SourceListsService) private readonly lists: SourceListsService,
	) {}

	@Get()
	async list() {
		return this.lists.list();
	}

	@Get(":id/sources")
	async sources(@Param("id") id: string) {
		return this.lists.sources(id);
	}

	@Post("import")
	async importList(@Body() body: { file?: string }) {
		if (typeof body.file !== "string" || body.file.length === 0) {
			throw new BadRequestException("sourceList.importInvalidJson");
		}
		return this.lists.importListFile(body.file);
	}

	@Post("refresh")
	async refresh() {
		return this.lists.refreshCatalog();
	}

	@Post(":id/enable")
	async enable(@Param("id") id: string) {
		return this.lists.enable(id);
	}

	@Post(":id/disable")
	async disable(@Param("id") id: string) {
		return this.lists.disable(id);
	}

	/** v1.8.1 — update one downloaded community list from its repo file. */
	@Post(":id/update")
	async update(@Param("id") id: string) {
		return this.lists.updateFromRepo(id);
	}

	@Delete(":id")
	async remove(@Param("id") id: string, @Query("force") force?: string) {
		await this.lists.remove(id, force === "true");
		return { id, removed: true };
	}
}
