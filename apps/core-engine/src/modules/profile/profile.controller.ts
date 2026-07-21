import { Body, Controller, Get, Inject, Patch, Post } from "@nestjs/common";
import { ProfileService } from "./profile.service.js";
import type { UpdateUserProfileInput } from "@vorynth/types";

/**
 * Profile endpoints (v1.1.0).
 *
 *   GET   /profile                          read the single profile row
 *   PATCH /profile                          update name / alias / language /
 *                                           custom instruction / topics
 *   POST  /profile/generate-summary         LLM behavior summary from history
 *   POST  /profile/improve-instruction      body { text } — improve a draft
 *
 * Both LLM operations require a configured provider; the service surfaces that
 * as a thrown error the frontend renders as a "configure a provider" empty
 * state (consistent with Search's news-mode handling).
 */
@Controller("profile")
export class ProfileController {
	constructor(
		@Inject(ProfileService) private readonly profile: ProfileService,
	) {}

	@Get()
	async get() {
		return this.profile.get();
	}

	@Patch()
	async update(@Body() body: UpdateUserProfileInput) {
		return this.profile.update(body ?? {});
	}

	@Post("generate-summary")
	async generateSummary() {
		return this.profile.generateSummary();
	}

	@Post("improve-instruction")
	async improveInstruction(@Body() body: { text: string }) {
		return this.profile.improveInstruction(body?.text ?? "");
	}
}
