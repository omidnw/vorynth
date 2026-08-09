import { Module } from "@nestjs/common";
import { UsageController } from "./usage.controller.js";
import { UsageService } from "./usage.service.js";

/**
 * Usage module (v1.8.0) — storage + resource usage snapshot for Settings.
 *
 * Depends only on the global `DbModule` (it walks the data dir + reads
 * articles/article_media directly). Registered in `AppModule`.
 */
@Module({
	controllers: [UsageController],
	providers: [UsageService],
	exports: [UsageService],
})
export class UsageModule {}
