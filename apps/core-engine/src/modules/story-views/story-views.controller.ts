import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Inject,
	NotFoundException,
	Post,
	Query,
} from "@nestjs/common";
import { StoryViewsService } from "./story-views.service.js";

/**
 * Story-view history endpoints (v1.8.0).
 *
 *   POST /story-views   body { articleId, scope: 'insight' | 'article' }
 *   GET  /story-views?limit=   recent views joined with article titles
 *
 * Recorded automatically when the user opens a story's insight page or its
 * article; surfaced in the Brief page's History tab.
 */
@Controller("story-views")
export class StoryViewsController {
	constructor(
		@Inject(StoryViewsService) private readonly views: StoryViewsService,
	) {}

	@Post()
	record(@Body() body: { articleId?: string; scope?: string }) {
		const articleId = body?.articleId?.trim() ?? "";
		if (!articleId) {
			throw new BadRequestException("story-views: articleId is required");
		}
		if (body?.scope !== "insight" && body?.scope !== "article") {
			throw new BadRequestException(
				"story-views: scope must be 'insight' or 'article'",
			);
		}
		if (!this.views.articleExists(articleId)) {
			throw new NotFoundException(`article not found: ${articleId}`);
		}
		return this.views.record(articleId, body.scope);
	}

	@Get()
	list(@Query("limit") limit?: string) {
		const parsed = Number.parseInt(limit ?? "", 10);
		const n = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 500) : 50;
		return { views: this.views.list(n) };
	}
}
