import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../../db/database.service.js";
import { llmProviders as llmProvidersTable } from "../../db/schema.js";
import { CryptoService } from "../crypto/crypto.service.js";
import type {
	AnalyzeInput,
	GenerateInput,
	InsightDraft,
	LlmProvider,
	LlmProviderKind,
	ProviderConstructorOpts,
} from "./llm-provider.js";
import { AnthropicProvider } from "./providers/anthropic-provider.js";
import { GeminiProvider } from "./providers/gemini-provider.js";
import { OllamaProvider } from "./providers/ollama-provider.js";
import { OpenAiProvider } from "./providers/openai-provider.js";
import { RateLimiter } from "./rate-limiter.js";
import { UsageService } from "./usage.service.js";

/**
 * Result of a rate-limited analyze call. The draft is the structured insight;
 * the metadata is what we surface in the Settings usage panel.
 */
export interface AnalyzeResult {
	draft: InsightDraft;
	usage: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
		durationMs: number;
	};
}

/**
 * Resolves the active LLM provider (project-details.md §24).
 *
 * The active provider is the most recently inserted enabled row in
 * `llm_providers` whose API key (or baseUrl for Ollama) decrypts cleanly. As a
 * dev convenience, a provider can also come from env vars so the slice still
 * works without the Settings UI.
 *
 * Every `analyze` call goes through:
 *   1. The `RateLimiter` (default 5 req/min, overridable via
 *      VORYNTH_LLM_RPM) — so we never blow past a provider's RPM.
 *   2. The `UsageService` — tokens + duration recorded to `usage_events` and
 *      surfaced in Settings.
 */
@Injectable()
export class LlmService implements OnModuleInit {
	private readonly logger = new Logger("Llm");
	private cached: { provider: LlmProvider; rowId: string } | null = null;

	constructor(
		@Inject(ConfigService) private readonly config: ConfigService,
		@Inject(DatabaseService) private readonly db: DatabaseService,
		@Inject(CryptoService) private readonly crypto: CryptoService,
		@Inject(RateLimiter) private readonly limiter: RateLimiter,
		@Inject(UsageService) private readonly usage: UsageService,
	) {}

	onModuleInit() {
		const active = this.peekActive();
		if (active) this.logger.log(`active provider on boot: ${active.kind}`);
		else this.logger.log("no LLM provider configured — running in news mode");
		this.logger.log(`rate limit: ${this.limiter.capacity} req/min`);
	}

	/** True when a provider is wired and (best-effort) reachable. */
	async isAvailable(): Promise<boolean> {
		const provider = this.getActive();
		if (!provider) return false;
		if (this.verifiedAt && Date.now() - this.verifiedAt < 30_000)
			return this.lastVerified;
		const ok = await provider.verify();
		this.lastVerified = ok;
		this.verifiedAt = Date.now();
		return ok;
	}

	get activeKind(): string {
		return this.getActive()?.kind ?? "none";
	}

	/** Live rate-limiter state (for progress UI). */
	get rateLimit(): { capacity: number; inFlight: number } {
		return { capacity: this.limiter.capacity, inFlight: this.limiter.inFlight };
	}

	/**
	 * Rate-limited analyze. Awaits a free slot before invoking the provider,
	 * records token usage when it returns, and re-throws on failure (still
	 * recorded as a failed event).
	 */
	async analyze(input: AnalyzeInput): Promise<InsightDraft> {
		const result = await this.invokeWithBudget("analyze", (provider) =>
			provider.analyze(input),
		);
		return result.draft;
	}

	/**
	 * Free-form generation (v1.1.0). Used by the Profile page to build a
	 * behavior summary from history and to improve the user's custom
	 * instruction draft. Same rate-limiting + usage recording as `analyze`.
	 */
	async generate(input: GenerateInput): Promise<string> {
		const result = await this.invokeWithBudget("generate", (provider) =>
			provider.generate(input),
		);
		return result.draft;
	}

	/**
	 * Period-summary generation. Like {@link generate}, the prompt is split into
	 * a system instruction and a user message that providers map onto their
	 * native chat roles — the caller owns the full prompt shape (unlike
	 * {@link analyze}, which re-wraps with the per-article prompt). Used by
	 * `IntelligenceService.summarizePeriod()` to produce a rich, multi-point
	 * briefing over a whole period's stories. The caller parses the returned
	 * JSON itself (the schema is summary-specific, not the flat `InsightDraft`).
	 */
	async summarize(input: GenerateInput): Promise<string> {
		const result = await this.invokeWithBudget("summarize", (provider) =>
			provider.generate(input),
		);
		return result.draft;
	}

	/**
	 * Lower-level entry point used by the analyzer node, summary service, and
	 * AI search. Returns the full result with token counts. ALWAYS rate-limited.
	 */
	async invokeWithBudget<T>(
		operation: "analyze" | "summarize" | "search" | "verify" | "generate",
		body: (provider: LlmProvider) => Promise<T>,
	): Promise<{ draft: T; usage: AnalyzeResult["usage"] }> {
		const provider = this.getActive();
		if (!provider) {
			throw new Error(
				"no LLM provider configured — add one in Settings or set an *_API_KEY env var",
			);
		}

		await this.limiter.acquire(operation);
		const start = Date.now();
		try {
			const draft = await body(provider);
			const durationMs = Date.now() - start;
			// Providers don't all expose token metadata; we estimate from the
			// draft size when it's a string-ish value.
			const responseText =
				typeof draft === "string" ? draft : JSON.stringify(draft);
			const usage = {
				promptTokens: 0,
				completionTokens: Math.ceil(responseText.length / 4),
				totalTokens: Math.ceil(responseText.length / 4),
				durationMs,
			};
			await this.usage.record({
				operation,
				providerKind: provider.kind,
				responseText,
				durationMs,
				ok: true,
			});
			return { draft, usage };
		} catch (err) {
			await this.usage.record({
				operation,
				providerKind: provider.kind,
				durationMs: Date.now() - start,
				ok: false,
			});
			throw err;
		}
	}

	/** Drop the cache so the next call re-reads configuration from the DB. */
	invalidate(): void {
		this.cached = null;
		this.verifiedAt = 0;
	}

	private verifiedAt = 0;
	private lastVerified = false;

	// ── active provider resolution ───────────────────────────────────────────

	private getActive(): LlmProvider | null {
		if (this.cached) return this.cached.provider;
		const built = this.buildActive();
		if (built) {
			this.cached = built;
			return built.provider;
		}
		return null;
	}

	private peekActive(): { kind: LlmProviderKind } | null {
		const built = this.buildActive();
		if (!built) return null;
		this.cached = built;
		return { kind: built.provider.kind };
	}

	/**
	 * Builds the active provider without caching. Priority:
	 *   1. Most recent enabled DB row with a decryptable secret/baseUrl.
	 *   2. Env-var fallback (dev convenience).
	 */
	private buildActive(): { provider: LlmProvider; rowId: string } | null {
		// 1. DB rows (most recent first).
		const rows = this.db.rawDb
			.prepare(
				`SELECT * FROM llm_providers WHERE enabled = 1 ORDER BY created_at DESC LIMIT 8`,
			)
			.all() as Array<{
			id: string;
			kind: LlmProviderKind;
			label: string;
			encrypted_api_key: string | null;
			default_model: string | null;
			base_url: string | null;
		}>;

		for (const row of rows) {
			const opts: ProviderConstructorOpts = {
				model: row.default_model ?? undefined,
				baseUrl: row.base_url ?? undefined,
			};
			if (row.encrypted_api_key) {
				try {
					opts.apiKey = this.crypto.decrypt(row.encrypted_api_key);
				} catch {
					this.logger.warn(`failed to decrypt key for ${row.label} — skipping`);
					continue;
				}
			}
			const provider = this.instantiate(row.kind, opts);
			if (provider) return { provider, rowId: row.id };
		}

		// 2. Env fallback.
		const env = this.envProvider();
		if (env) {
			const provider = this.instantiate(env.kind, env.opts);
			if (provider) return { provider, rowId: "env" };
		}

		return null;
	}

	private instantiate(
		kind: LlmProviderKind,
		opts: ProviderConstructorOpts,
	): LlmProvider | null {
		try {
			switch (kind) {
				case "openai":
					if (!opts.apiKey) return null;
					return new OpenAiProvider({
						apiKey: opts.apiKey,
						model: opts.model,
						baseUrl: opts.baseUrl,
					});
				case "gemini":
					if (!opts.apiKey) return null;
					return new GeminiProvider({ apiKey: opts.apiKey, model: opts.model });
				case "anthropic":
					if (!opts.apiKey) return null;
					return new AnthropicProvider({
						apiKey: opts.apiKey,
						model: opts.model,
					});
				case "ollama":
					return new OllamaProvider({
						baseUrl: opts.baseUrl,
						model: opts.model,
					});
				default:
					return null;
			}
		} catch (err) {
			this.logger.warn(
				`failed to instantiate ${kind}: ${(err as Error).message}`,
			);
			return null;
		}
	}

	private envProvider(): {
		kind: LlmProviderKind;
		opts: ProviderConstructorOpts;
	} | null {
		const openai = this.config.get<string>("OPENAI_API_KEY");
		if (openai) {
			return {
				kind: "openai",
				opts: {
					apiKey: openai,
					model: this.config.get<string>("OPENAI_MODEL") ?? undefined,
				},
			};
		}
		const gemini = this.config.get<string>("GEMINI_API_KEY");
		if (gemini) {
			return {
				kind: "gemini",
				opts: {
					apiKey: gemini,
					model: this.config.get<string>("GEMINI_MODEL") ?? undefined,
				},
			};
		}
		const anthropic = this.config.get<string>("ANTHROPIC_API_KEY");
		if (anthropic) {
			return {
				kind: "anthropic",
				opts: {
					apiKey: anthropic,
					model: this.config.get<string>("ANTHROPIC_MODEL") ?? undefined,
				},
			};
		}
		return null;
	}

	// ── DB CRUD used by LlmController ────────────────────────────────────────

	async listProviders() {
		return this.db.db
			.select()
			.from(llmProvidersTable)
			.orderBy(llmProvidersTable.createdAt);
	}

	async saveProvider(input: {
		id?: string;
		kind: LlmProviderKind;
		label: string;
		apiKey?: string;
		defaultModel?: string;
		baseUrl?: string;
		enabled?: boolean;
	}) {
		const encryptedApiKey = input.apiKey
			? this.crypto.encrypt(input.apiKey)
			: null;
		const id = input.id ?? `llm-${Date.now().toString(36)}`;
		const existing = await this.db.db
			.select()
			.from(llmProvidersTable)
			.where(eq(llmProvidersTable.id, id));

		if (existing.length > 0) {
			await this.db.db
				.update(llmProvidersTable)
				.set({
					label: input.label,
					kind: input.kind,
					defaultModel: input.defaultModel ?? null,
					baseUrl: input.baseUrl ?? null,
					enabled: input.enabled ?? true,
					// Only overwrite the key when a new one was supplied.
					encryptedApiKey:
						encryptedApiKey ?? existing[0]?.encryptedApiKey ?? null,
				})
				.where(eq(llmProvidersTable.id, id));
		} else {
			await this.db.db.insert(llmProvidersTable).values({
				id,
				kind: input.kind,
				label: input.label,
				encryptedApiKey,
				defaultModel: input.defaultModel ?? null,
				baseUrl: input.baseUrl ?? null,
				enabled: input.enabled ?? true,
			});
		}

		this.invalidate();
		return this.db.db
			.select()
			.from(llmProvidersTable)
			.where(eq(llmProvidersTable.id, id));
	}

	async deleteProvider(id: string) {
		await this.db.db
			.delete(llmProvidersTable)
			.where(eq(llmProvidersTable.id, id));
		this.invalidate();
	}
}
