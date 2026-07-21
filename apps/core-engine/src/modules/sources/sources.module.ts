import { Module } from "@nestjs/common";
import { SourcesController } from "./sources.controller.js";
import { SourcesService } from "./sources.service.js";

@Module({
	controllers: [SourcesController],
	providers: [SourcesService],
	exports: [SourcesService],
})
export class SourcesModule {}
