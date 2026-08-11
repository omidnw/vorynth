import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Inject,
	NotFoundException,
	Param,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import { StoryViewsService } from "./story-views.service.js";

/**
 * Story-view history endpoints (v1.8.0).
 *
 *   POST  /story-views   body { articleId, scope: 'insight' | 'article' }
 *   GET   /story-views?limit=   recent views joined with article titles
 *   PATCH /story-views/:id      body { read: boolean } — the "Mark read" toggle
 *
 * Recorded automatically when the user opens a story's insight page or its
 * article (opening marks the view read — v1.8.1); surfaced in the Brief
 * page's History tab with a read indicator.
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

	@Patch(":id")
	setRead(@Param("id") id: string, @Body() body: { read?: unknown }) {
		const viewId = Number.parseInt(id, 10);
		if (!Number.isInteger(viewId) || viewId <= 0) {
			throw new BadRequestException("story-views: invalid view id");
		}
		if (typeof body?.read !== "boolean") {
			throw new BadRequestException("story-views: read must be a boolean");
		}
		this.views.setRead(viewId, body.read);
		return { id: viewId, read: body.read };
	}

	/**
	 * v1.8.1 — mark a whole STORY read by article id (the brief-card "Mark
	 * read" button): toggles the latest view row, creating one if the story
	 * was never opened.
	 */
	@Post("article/:articleId/read")
	setArticleRead(
		@Param("articleId") articleId: string,
		@Body() body: { read?: unknown },
	) {
		const id = articleId?.trim() ?? "";
		if (!id) {
			throw new BadRequestException("story-views: articleId is required");
		}
		if (typeof body?.read !== "boolean") {
			throw new BadRequestException("story-views: read must be a boolean");
		}
		if (!this.views.articleExists(id)) {
			throw new NotFoundException(`article not found: ${id}`);
		}
		this.views.setArticleRead(id, body.read);
		return { articleId: id, read: body.read };
	}

	@Get()
	list(@Query("limit") limit?: string) {
		const parsed = Number.parseInt(limit ?? "", 10);
		const n = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 500) : 50;
		return { views: this.views.list(n) };
	}
}
