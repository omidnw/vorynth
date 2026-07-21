import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	Patch,
	Query,
} from "@nestjs/common";
import { HistoryService } from "./history.service.js";
import type { AppSettings, UpdateHistoryEntryInput } from "@vorynth/types";

/**
 * History + app-settings endpoints.
 *
 *   GET    /history/search?includeArchived=   list search-history entries
 *   GET    /history/search/:id                fetch one search entry
 *   PATCH  /history/search/:id                rename / archive one entry
 *   DELETE /history/search                    body { ids: string[] } — delete many
 *
 *   GET    /history/brief?includeArchived=    list brief-history entries
 *   GET    /history/brief/:id                 fetch one brief entry
 *   PATCH  /history/brief/:id                 rename / archive one entry
 *   DELETE /history/brief                     body { ids: string[] } — delete many
 *
 *   GET    /history/generated?includeArchived=  list generated-history entries
 *   GET    /history/generated/:id                fetch one generated entry
 *   PATCH  /history/generated/:id                rename / archive one entry
 *   DELETE /history/generated                     body { ids: string[] } — delete many
 *
 *   GET    /settings                          read all app settings
 *   PATCH  /settings                          upsert one or more settings
 */
@Controller()
export class HistoryController {
	constructor(
		@Inject(HistoryService) private readonly history: HistoryService,
	) {}

	// ── Search history ────────────────────────────────────────────────────

	@Get("history/search")
	async listSearch(@Query("includeArchived") includeArchived?: string) {
		return this.history.listSearch(includeArchived === "true");
	}

	@Get("history/search/:id")
	async getSearch(@Param("id") id: string) {
		return this.history.getSearch(id);
	}

	@Patch("history/search/:id")
	async updateSearch(
		@Param("id") id: string,
		@Body() body: UpdateHistoryEntryInput,
	) {
		return this.history.updateSearch(id, body);
	}

	@Delete("history/search")
	async deleteSearch(@Body() body: { ids: string[] }) {
		const removed = this.history.deleteSearch(body?.ids ?? []);
		return { removed };
	}

	// ── Brief history ─────────────────────────────────────────────────────

	@Get("history/brief")
	async listBrief(@Query("includeArchived") includeArchived?: string) {
		return this.history.listBrief(includeArchived === "true");
	}

	@Get("history/brief/:id")
	async getBrief(@Param("id") id: string) {
		return this.history.getBrief(id);
	}

	@Patch("history/brief/:id")
	async updateBrief(
		@Param("id") id: string,
		@Body() body: UpdateHistoryEntryInput,
	) {
		return this.history.updateBrief(id, body);
	}

	@Delete("history/brief")
	async deleteBrief(@Body() body: { ids: string[] }) {
		const removed = this.history.deleteBrief(body?.ids ?? []);
		return { removed };
	}

	// ── Generated history (Profile LLM generations) ───────────────────────

	@Get("history/generated")
	async listGenerated(@Query("includeArchived") includeArchived?: string) {
		return this.history.listGenerated(includeArchived === "true");
	}

	@Get("history/generated/:id")
	async getGenerated(@Param("id") id: string) {
		return this.history.getGenerated(id);
	}

	@Patch("history/generated/:id")
	async updateGenerated(
		@Param("id") id: string,
		@Body() body: UpdateHistoryEntryInput,
	) {
		return this.history.updateGenerated(id, body);
	}

	@Delete("history/generated")
	async deleteGenerated(@Body() body: { ids: string[] }) {
		const removed = this.history.deleteGenerated(body?.ids ?? []);
		return { removed };
	}

	// ── App settings ──────────────────────────────────────────────────────

	@Get("settings")
	async getSettings(): Promise<AppSettings> {
		return this.history.getSettings();
	}

	@Patch("settings")
	async patchSettings(
		@Body() body: Partial<AppSettings>,
	): Promise<AppSettings> {
		for (const [key, value] of Object.entries(body ?? {})) {
			this.history.setSetting(key, value);
		}
		return this.history.getSettings();
	}
}
