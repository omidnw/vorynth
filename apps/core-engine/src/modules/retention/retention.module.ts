import { Module } from "@nestjs/common";
import { RetentionService } from "./retention.service.js";
import { HistoryModule } from "../history/history.module.js";

@Module({
	imports: [HistoryModule],
	providers: [RetentionService],
	exports: [RetentionService],
})
export class RetentionModule {}
