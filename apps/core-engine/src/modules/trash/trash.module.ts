import { Module } from "@nestjs/common";
import { ArchiveModule } from "../archive/archive.module.js";
import { HistoryModule } from "../history/history.module.js";
import { TrashController } from "./trash.controller.js";
import { TrashService } from "./trash.service.js";

/**
 * Trash module (v1.7.0) — soft-deleted collections & history.
 *
 * Depends on Archive (collection soft-delete/restore/purge) and History
 * (entry soft-delete/restore/purge + the `trash.*` retention settings).
 */
@Module({
	imports: [ArchiveModule, HistoryModule],
	controllers: [TrashController],
	providers: [TrashService],
	exports: [TrashService],
})
export class TrashModule {}
