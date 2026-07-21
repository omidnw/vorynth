import { Module } from "@nestjs/common";
import { NewsController } from "./news.controller.js";
import { NewsService } from "./news.service.js";

@Module({
	controllers: [NewsController],
	providers: [NewsService],
	exports: [NewsService],
})
export class NewsModule {}
