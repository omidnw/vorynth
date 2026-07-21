import { Module } from "@nestjs/common";
import { MediaController } from "./media.controller.js";
import { MediaService } from "./media.service.js";

/**
 * Media module (v1.1.0) — article media extraction + local-storage control.
 *
 * Depends only on the global `DbModule` (it reads articles/sources directly).
 * Registered in `AppModule`.
 */
@Module({
	controllers: [MediaController],
	providers: [MediaService],
	exports: [MediaService],
})
export class MediaModule {}
