import { Module } from "@nestjs/common";
import { ArchiveModule } from "../archive/archive.module.js";
import { BookmarksController } from "./bookmarks.controller.js";
import { BookmarksService } from "./bookmarks.service.js";

@Module({
	imports: [ArchiveModule],
	controllers: [BookmarksController],
	providers: [BookmarksService],
	exports: [BookmarksService],
})
export class BookmarksModule {}
