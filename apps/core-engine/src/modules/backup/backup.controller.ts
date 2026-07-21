import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	Post,
} from "@nestjs/common";
import { BackupService } from "./backup.service.js";

/**
 * Backup / restore / delete-all endpoints (project-details.md §32.3 – §32.5).
 *
 *   POST   /backup/export           create a `.vorynth-backup` archive
 *   GET    /backup                  list existing backups
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
