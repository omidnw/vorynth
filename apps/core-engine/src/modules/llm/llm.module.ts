import { Module } from "@nestjs/common";
import { LlmController } from "./llm.controller.js";
import { LlmService } from "./llm.service.js";
import { RateLimiter } from "./rate-limiter.js";
import { UsageService } from "./usage.service.js";

@Module({
	controllers: [LlmController],
	providers: [LlmService, RateLimiter, UsageService],
	exports: [LlmService, RateLimiter, UsageService],
})
export class LlmModule {}
