import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DbModule } from "./db/db.module.js";
import { CryptoModule } from "./modules/crypto/crypto.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { SourcesModule } from "./modules/sources/sources.module.js";
import { CrawlerModule } from "./modules/crawler/crawler.module.js";
import { NewsModule } from "./modules/news/news.module.js";
import { LlmModule } from "./modules/llm/llm.module.js";
import { HistoryModule } from "./modules/history/history.module.js";
import { IntelligenceModule } from "./modules/intelligence/intelligence.module.js";
import { SearchModule } from "./modules/search/search.module.js";
import { BackupModule } from "./modules/backup/backup.module.js";
import { JobsModule } from "./modules/jobs/jobs.module.js";
import { SchedulerModule } from "./modules/scheduler/scheduler.module.js";
import { MediaModule } from "./modules/media/media.module.js";
import { ProfileModule } from "./modules/profile/profile.module.js";

/**
 * Root application module.
 *
 * Composition order is deliberate: config first, then DB + Crypto (the global
 * infrastructure both used by feature modules), then feature modules in
 * dependency order: News before Intelligence (workflow layers onto the news
 * feed), LLM before Intelligence (workflow injects LlmService), History before
 * Search + Intelligence (both record entries into it), Search before Scheduler
 * (search injects LlmService), Jobs near the end (depends on Crawler
 * + Intelligence), Scheduler last (depends on Crawler + Intelligence).
 */
@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: [".env"],
		}),
		DbModule,
		CryptoModule,
		HealthModule,
		SourcesModule,
		CrawlerModule,
		NewsModule,
		LlmModule,
		HistoryModule,
		IntelligenceModule,
		SearchModule,
		BackupModule,
		JobsModule,
		SchedulerModule,
		// v1.1.0 — media extraction + profile personalization. Registered after
		// History + LLM since ProfileModule depends on both.
		MediaModule,
		ProfileModule,
	],
})
export class AppModule {}
