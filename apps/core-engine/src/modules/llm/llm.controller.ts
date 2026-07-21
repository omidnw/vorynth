import {
	Body,
	Controller,
	Delete,
	Get,
	Inject,
	Param,
	Post,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LlmService } from "./llm.service.js";
import { UsageService } from "./usage.service.js";
import type { EngineStatus } from "@vorynth/types";
import { VORYNTH_VERSION } from "@vorynth/types";
import { DatabaseService } from "../../db/database.service.js";
import { eq, sql } from "drizzle-orm";
import { sources, articles } from "../../db/schema.js";
import type { LlmProviderKind } from "./llm-provider.js";

/**
 * LLM provider configuration + engine status + usage endpoints.
 *
 *   GET    /llm/providers       list configured providers (no secrets)
 *   POST   /llm/providers       create or update a provider (+ encrypted key)
 *   DELETE /llm/providers/:id   remove a provider
 *   GET    /llm/status          active provider + live rate-limit state
 *   POST   /llm/verify          onboarding "verify connection" check
 *   GET    /llm/usage           aggregated token/request spend (Settings)
 *   DELETE /llm/usage           reset usage history
 *   GET    /status              full engine status for the frontend
 */
@Controller()
export class LlmController {
	constructor(
		@Inject(LlmService) private readonly llm: LlmService,
		@Inject(UsageService) private readonly usageSvc: UsageService,
		@Inject(ConfigService) private readonly config: ConfigService,
		@Inject(DatabaseService) private readonly db: DatabaseService,
	) {}

	@Get("llm/providers")
	async list() {
		const rows = await this.llm.listProviders();
		// Never return the encrypted blob to the client.
		return rows.map((r) => ({
			id: r.id,
			kind: r.kind,
			label: r.label,
			apiKeyStored: Boolean(r.encryptedApiKey),
			defaultModel: r.defaultModel,
			baseUrl: r.baseUrl,
			enabled: r.enabled,
		}));
	}

	@Post("llm/providers")
	async save(
		@Body()
		body: {
			id?: string;
			kind: LlmProviderKind;
			label: string;
			apiKey?: string;
			defaultModel?: string;
			baseUrl?: string;
			enabled?: boolean;
		},
	) {
		const [row] = await this.llm.saveProvider(body);
		return row;
	}

	@Delete("llm/providers/:id")
	async remove(@Param("id") id: string) {
		await this.llm.deleteProvider(id);
		return { id, removed: true };
	}

	@Get("llm/status")
	async status() {
		const ok = await this.llm.isAvailable();
		return {
			configured: ok,
			providerKind: ok ? this.llm.activeKind : null,
			rateLimit: this.llm.rateLimit,
		};
	}

	@Post("llm/verify")
	async verify() {
		const ok = await this.llm.isAvailable();
		return { ok, providerKind: this.llm.activeKind };
	}

	@Get("llm/usage")
	async usage() {
		return this.usageSvc.summary();
	}

	@Delete("llm/usage")
	async resetUsage() {
		await this.usageSvc.reset();
		return { ok: true };
	}

	@Get("status")
	async engineStatus(): Promise<EngineStatus> {
		const configured = await this.llm.isAvailable();

		const enabledSources = await this.db.db
			.select({ count: sql<number>`count(*)` })
			.from(sources)
			.where(eq(sources.enabled, true));
		const totalSources = await this.db.db
			.select({ count: sql<number>`count(*)` })
			.from(sources);
		const totalArticles = await this.db.db
			.select({ count: sql<number>`count(*)` })
			.from(articles);

		return {
			ready: true,
			version: VORYNTH_VERSION,
			llm: {
				configured,
				providerKind: configured ? this.llm.activeKind : null,
			},
			sources: {
				total: Number(totalSources[0]?.count ?? 0),
				enabled: Number(enabledSources[0]?.count ?? 0),
			},
			articles: {
				total: Number(totalArticles[0]?.count ?? 0),
			},
		};
	}
}
