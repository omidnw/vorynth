import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	Post,
	StreamableFile,
} from "@nestjs/common";
import { createReadStream } from "node:fs";
import { BackupService } from "./backup.service.js";

/**
 * Backup / restore / delete-all endpoints (project-details.md §32.3 – §32.5).
 *
 *   POST   /backup/export           create a `.vorynth-backup` archive
 *   GET    /backup                  list existing backups
 *   GET    /backup/:name/file       download a backup's bytes (save to disk)
 *   POST   /backup/restore          restore from a backup file path
 *   DELETE /backup/:name            remove a specific backup file
 *   POST   /backup/delete-all       permanently wipe ALL local data
 */
@Controller("backup")
export class BackupController {
	constructor(@Inject(BackupService) private readonly backup: BackupService) {}

	@Post("export")
	async export() {
		return this.backup.export();
	}

	@Get()
	async list() {
		return { backups: await this.backup.list() };
	}

	/** Stream a backup's bytes so the user can save it anywhere (v1.8.0). */
	@Get(":name/file")
	async download(@Param("name") name: string): Promise<StreamableFile> {
		const path = await this.backup.resolve(name);
		return new StreamableFile(createReadStream(path), {
			type: "application/octet-stream",
			disposition: `attachment; filename="${name}"`,
		});
	}

	@Post("restore")
	async restore(@Body() body: { path: string }) {
		return this.backup.restore(body.path);
	}

	@Delete(":name")
	async remove(@Param("name") name: string) {
		return this.backup.remove(name);
	}

	@Post("delete-all")
	async deleteAll() {
		return this.backup.deleteAll();
	}
}
