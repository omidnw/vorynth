import {
	BadRequestException,
	HttpException,
	Inject,
	Injectable,
	Logger,
	type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../../db/database.service.js";
import { llmProviders as llmProvidersTable } from "../../db/schema.js";
import { CryptoService } from "../crypto/crypto.service.js";
import { HistoryService } from "../history/history.service.js";
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
/** Best-effort classification of a provider call failure into a UI code. */
function providerErrorCode(err: unknown): string | null {
	const e = err as {
		status?: number;
		statusCode?: number;
		response?: { status?: number };
		code?: string;
	};
	const status = e.status ?? e.statusCode ?? e.response?.status ?? null;
	if (status === 401 || status === 403) return "LLM_AUTH_FAILED";
	if (status === 429) return "LLM_RATE_LIMITED";
	if (status !== null && status >= 500) return "LLM_UNREACHABLE";
	if (
		typeof e.code === "string" &&
		/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|UND_ERR|CERT_HAS_EXPIRED|DEPTH_ZERO_SELF_SIGNED_CERT/.test(
			e.code,
		)
	) {
		return "LLM_UNREACHABLE";
	}
	return null;
}

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
		@Inject(HistoryService) private readonly history: HistoryService,
	) {}

	onModuleInit() {
		// Seed the mode setting on first-ever run so the very first load uses
		// the correct default (intelligence when a provider is configured).
		const existing = this.history.getSetting<string | null>(
			"engine.mode",
			null,
		);
		if (existing === null) {
			const mode = this.autoMode();
			this.logger.log(`seeding initial mode: ${mode}`);
			this.history.setSetting("engine.mode", mode);
		}

		const active = this.peekActive();
		const mode = this.getMode();
		if (active) {
			this.logger.log(
				`active provider on boot: ${active.kind} | mode: ${mode} | provider rows: ${this.countProviders()}`,
			);
		} else {
			this.logger.log(
				`no LLM provider configured — running in news mode (mode=${mode} | provider rows: ${this.countProviders()})`,
			);
		}
		this.logger.log(`rate limit: ${this.limiter.capacity} req/min`);
	}

	/**
	 * True when the engine is in intelligence mode AND a provider is configured
	 * (key decrypts successfully). Unlike v1.4.x, this does NOT call the live
	 * verify() endpoint — a stored key that decrypts is enough. The user
	 * explicitly controls the mode via the Settings UI.
	 *
	 * When mode is "news", isAvailable() returns false regardless of providers.
	 */
	async isAvailable(): Promise<boolean> {
		if (this.getMode() === "news") return false;
		const active = this.getActive();
		return active !== null;
	}

	get activeKind(): string {
		return this.getActive()?.kind ?? "none";
	}

	// ── mode ───────────────────────────────────────────────────────────────────

	/**
	 * Read the current mode. Always resolves fresh from the DB so there is no
	 * stale-cache issue. The user's explicit choice (set via {@link setMode}) is
	 * stored in `engine.mode`; on first boot the setting is seeded by
	 * {@link onModuleInit} with {@link autoMode}.
	 */
	getMode(): "intelligence" | "news" {
		const persisted = this.history.getSetting<"intelligence" | "news">(
			"engine.mode",
			this.autoMode(),
		);
		return persisted;
	}

	/**
	 * Persist the user's mode choice. Once set, every {@link getMode} call reads
	 * this value until the user changes it again.
	 */
	setMode(mode: "intelligence" | "news"): void {
		this.history.setSetting("engine.mode", mode);
		this.invalidate();
		this.logger.log(`mode set by user: ${mode}`);
	}

	/**
	 * Auto-detected mode: returns "intelligence" if {@link buildActive} can
	 * resolve a working provider (key decrypts + instantiates), "news" otherwise.
	 * Used as the fallback when no user preference has ever been stored.
	 */
	autoMode(): "intelligence" | "news" {
		return this.buildActive() ? "intelligence" : "news";
	}

	/** The ID of the provider the user explicitly selected as active, if any. */
	getActiveProviderId(): string | null {
		return this.history.getSetting<string | null>(
			"engine.activeProviderId",
			null,
		);
	}

	/** Set which provider is active (only one at a time). */
	setActiveProviderId(id: string | null): void {
		this.history.setSetting("engine.activeProviderId", id);
		this.invalidate();
	}

	/** Live rate-limiter state (for progress UI). */
	get rateLimit(): { capacity: number; inFlight: number; spacingMs: number } {
		return {
			capacity: this.limiter.capacity,
			inFlight: this.limiter.inFlight,
			spacingMs: this.limiter.spacingMs,
		};
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
			throw this.unavailableException();
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
			throw this.mapProviderError(err);
		}
	}

	/** Drop the cached provider so the next call re-reads from the DB. */
	invalidate(): void {
		this.cached = null;
	}

	/** Count enabled provider rows (for diagnostics). */
	private countProviders(): number {
		const row = this.db.rawDb
			.prepare(`SELECT count(*) AS n FROM llm_providers WHERE enabled = 1`)
			.get() as { n: number } | undefined;
		return row?.n ?? 0;
	}

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
	 *   1. DB row matching `engine.activeProviderId` (if set).
	 *   2. Most recent enabled DB row with a decryptable secret/baseUrl.
	 *   3. Env-var fallback (dev convenience).
	 */
	private buildActive(): { provider: LlmProvider; rowId: string } | null {
		const activeId = this.getActiveProviderId();
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

		// 1. Try the user's explicitly selected provider first.
		if (activeId) {
			const chosen = rows.find((r) => r.id === activeId);
			if (chosen) {
				const built = this.tryBuild(chosen);
				if (built) return built;
			}
		}

		// 2. DB rows (most recent first).
		for (const row of rows) {
			const built = this.tryBuild(row);
			if (built) return built;
		}

		// 3. Env fallback.
		const env = this.envProvider();
		if (env) {
			const provider = this.instantiate(env.kind, env.opts);
			if (provider) return { provider, rowId: "env" };
		}

		return null;
	}

	/** Try to instantiate a provider from a DB row. Returns null on failure. */
	private tryBuild(row: {
		id: string;
		kind: LlmProviderKind;
		label: string;
		encrypted_api_key: string | null;
		default_model: string | null;
		base_url: string | null;
	}): { provider: LlmProvider; rowId: string } | null {
		const opts: ProviderConstructorOpts = {
			model: row.default_model ?? undefined,
			baseUrl: row.base_url ?? undefined,
		};
		if (row.encrypted_api_key) {
			try {
				opts.apiKey = this.crypto.decrypt(row.encrypted_api_key);
			} catch {
				this.logger.warn(`failed to decrypt key for ${row.label} — skipping`);
				return null;
			}
		}
		const provider = this.instantiate(row.kind, opts);
		if (provider) return { provider, rowId: row.id };
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
					// v1.8.1 — apiKey is optional (local needs none; Ollama Cloud
					// sends it as a bearer header). tryBuild already decrypted the
					// stored key into opts.apiKey when one exists.
					return new OllamaProvider({
						baseUrl: opts.baseUrl,
						model: opts.model,
						apiKey: opts.apiKey,
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

	/**
	 * Health of a provider's stored key, from the client's point of view:
	 * decryptable ("ok"), never set ("missing"), or present but unreadable
	 * ("undecryptable" — e.g. the local master salt was lost in a restore or
	 * data-dir reset). The Settings UI uses this to tell the user a key must be
	 * re-entered instead of silently reporting "key stored" while the LLM stays
	 * unreachable.
	 */
	keyStatus(
		encryptedApiKey: string | null,
	): "ok" | "missing" | "undecryptable" {
		if (!encryptedApiKey) return "missing";
		try {
			this.crypto.decrypt(encryptedApiKey);
			return "ok";
		} catch {
			return "undecryptable";
		}
	}

	/**
	 * Why the AI provider can't be used right now — or null when it can.
	 * Distinguishes the three cases the UI can act on: nothing configured,
	 * a configured key that was never entered, or a key that can no longer be
	 * decrypted (e.g. the local master salt was lost in a restore).
	 */
	unavailableReason():
		"not-configured" | "key-missing" | "key-undecryptable" | null {
		if (this.buildActive()) return null;
		const rows = this.db.rawDb
			.prepare(`SELECT encrypted_api_key FROM llm_providers WHERE enabled = 1`)
			.all() as Array<{ encrypted_api_key: string | null }>;
		if (rows.length === 0) return "not-configured";
		if (
			rows.some((r) => this.keyStatus(r.encrypted_api_key) === "undecryptable")
		) {
			return "key-undecryptable";
		}
		if (rows.some((r) => this.keyStatus(r.encrypted_api_key) === "missing")) {
			return "key-missing";
		}
		return "not-configured";
	}

	/** A structured 400 explaining why the AI provider is unavailable. */
	unavailableException(): HttpException {
		const reason = this.unavailableReason() ?? "not-configured";
		const code =
			reason === "key-undecryptable"
				? "LLM_KEY_UNDECRYPTABLE"
				: reason === "key-missing"
					? "LLM_KEY_MISSING"
					: "LLM_NOT_CONFIGURED";
		const message =
			reason === "key-undecryptable"
				? "The AI provider's API key can't be decrypted — remove the provider and add it again in Settings."
				: reason === "key-missing"
					? "The active AI provider has no API key — re-enter it in Settings."
					: "No LLM provider is configured — add one in Settings or set an OPENAI_API_KEY / GEMINI_API_KEY / ANTHROPIC_API_KEY environment variable.";
		return new BadRequestException({ code, message });
	}

	/**
	 * Maps a failed provider call to a structured error code so the UI can say
	 * WHY the AI request failed (bad key, rate limit, unreachable). Errors that
	 * don't look like provider failures (domain errors, already-structured
	 * exceptions) pass through untouched.
	 */
	private mapProviderError(err: unknown): unknown {
		if (err instanceof HttpException) return err;
		const code = providerErrorCode(err);
		if (!code) return err;
		const message = (err as Error).message || "AI provider request failed.";
		return new BadRequestException({ code, message });
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
