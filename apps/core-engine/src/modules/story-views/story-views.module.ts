import { Module } from "@nestjs/common";
import { StoryViewsController } from "./story-views.controller.js";
import { StoryViewsService } from "./story-views.service.js";

@Module({
	controllers: [StoryViewsController],
	providers: [StoryViewsService],
	exports: [StoryViewsService],
})
export class StoryViewsModule {}
