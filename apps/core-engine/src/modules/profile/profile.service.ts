import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../../db/database.service.js";
import { userProfile } from "../../db/schema.js";
import { HistoryService } from "../history/history.service.js";
import { LlmService } from "../llm/llm.service.js";
import {
	buildBehaviorSummaryPrompt,
	buildImproveInstructionPrompt,
	type BehaviorStats,
} from "../llm/prompts/generate.prompt.js";
import type {
	GenerateSummaryResult,
	ImproveInstructionResult,
	SourceCategory,
	UpdateUserProfileInput,
	UserProfile,
} from "@vorynth/types";

/**
 * User profile + personalization (v1.1.0).
 *
 * Owns the single-row `user_profile` table (id="default") extended with
 * display-name, alias, custom-instruction, and behavior-summary fields. The
 * two LLM-backed operations — generate a behavior summary from history, and
 * improve a rough custom-instruction draft — both go through `LlmService`
 * (rate-limited + usage-recorded) and record their output into the generated
 * history scope so each generation is revisitable.
 */
@Injectable()
export class ProfileService {
	private readonly logger = new Logger("Profile");

	constructor(
		@Inject(DatabaseService) private readonly db: DatabaseService,
		@Inject(HistoryService) private readonly history: HistoryService,
		@Inject(LlmService) private readonly llm: LlmService,
	) {}

	/** Read the single profile row (creates it if missing — defensive). */
	async get(): Promise<UserProfile> {
		await this.ensureRow();
		const row = await this.db.db
			.select()
			.from(userProfile)
			.where(eq(userProfile.id, "default"))
			.get();
		return this.toDto(row!);
	}

	/** Patch editable fields. Returns the updated row. */
	async update(patch: UpdateUserProfileInput): Promise<UserProfile> {
		await this.ensureRow();
		const set: Record<string, unknown> = { updatedAt: new Date() };
		if (patch.firstName !== undefined) set.firstName = patch.firstName;
		if (patch.lastName !== undefined) set.lastName = patch.lastName;
		if (patch.alias !== undefined) set.alias = patch.alias;
		if (patch.preferredUiLanguage !== undefined)
			set.preferredUiLanguage = patch.preferredUiLanguage;
		if (patch.preferredIntelligenceLanguage !== undefined)
			set.preferredIntelligenceLanguage = patch.preferredIntelligenceLanguage;
		if (patch.customInstruction !== undefined)
			set.customInstruction = patch.customInstruction;
		if (patch.topics !== undefined) set.topics = patch.topics;
		if (patch.interests !== undefined) set.interests = patch.interests;

		await this.db.db
			.update(userProfile)
			.set(set)
			.where(eq(userProfile.id, "default"))
			.run();
		return this.get();
	}

	/**
	 * Generate a behavior summary from the user's search + brief history.
	 * Stores the result on the profile (so Profile page can show the latest)
	 * AND records the generation into generated history (so it's revisitable).
	 */
	async generateSummary(): Promise<GenerateSummaryResult> {
		const profile = await this.get();
		const stats = this.computeStats();
		const prompt = buildBehaviorSummaryPrompt(stats, {
			outputLanguage: profile.preferredIntelligenceLanguage || "en",
			customInstruction: profile.customInstruction || undefined,
		});

		const { draft, usage } = await this.llm.invokeWithBudget(
			"generate",
			(provider) => provider.generate(prompt),
		);
		const summary = draft.trim();
		const generatedAt = new Date();

		await this.db.db
			.update(userProfile)
			.set({
				behaviorSummary: summary,
				summaryGeneratedAt: generatedAt,
				updatedAt: generatedAt,
			})
			.where(eq(userProfile.id, "default"))
			.run();

		this.history.recordGenerated({
			kind: "behavior-summary",
			title: `Behavior summary — ${generatedAt.toLocaleString()}`,
			result: summary,
			tokensUsed: usage.totalTokens,
		});

		return {
			summary,
			generatedAt,
			tokensUsed: usage.totalTokens,
		};
	}

	/**
	 * Improve a rough custom-instruction draft. Returns original + improved
	 * without saving — the caller previews then applies via `update()`. The
	 * supplied text is also stashed as the "original draft" so the user can
	 * get back to it later, and the generation is recorded.
	 */
	async improveInstruction(text: string): Promise<ImproveInstructionResult> {
		const profile = await this.get();
		const prompt = buildImproveInstructionPrompt(text, {
			outputLanguage: profile.preferredIntelligenceLanguage || "en",
			customInstruction: profile.customInstruction || undefined,
		});

		const { draft, usage } = await this.llm.invokeWithBudget(
			"generate",
			(provider) => provider.generate(prompt),
		);
		const improved = draft.trim();

		this.history.recordGenerated({
			kind: "instruction-improve",
			title: text.trim().slice(0, 80) + (text.trim().length > 80 ? "…" : ""),
			result: improved,
			tokensUsed: usage.totalTokens,
		});

		return { original: text, improved, tokensUsed: usage.totalTokens };
	}

	/** The user's current custom instruction (used by search to bias Ask-AI). */
	async getCustomInstruction(): Promise<string> {
		const row = await this.db.db
			.select({ customInstruction: userProfile.customInstruction })
			.from(userProfile)
			.where(eq(userProfile.id, "default"))
			.get();
		return row?.customInstruction ?? "";
	}

	// ── Behavior stats from history ──────────────────────────────────────────

	/**
	 * Aggregate the user's history into the compact stats object the behavior
	 * summary is generated from. Never sends raw rows to the model — only
	 * counts + the top queries/categories.
	 */
	private computeStats(): BehaviorStats {
		const search = this.history.listSearch(true);
		const brief = this.history.listBrief(true);

		const totalSearches = search.items.length;
		const keywordSearches = search.items.filter(
			(s) => s.mode === "keyword",
		).length;
		const aiSearches = search.items.filter((s) => s.mode === "ai").length;
		const totalBriefs = brief.items.length;

		// Top queries: dedupe + count, most frequent first.
		const queryCounts = new Map<string, number>();
		for (const s of search.items) {
			const q = s.query.trim().toLowerCase();
			if (!q) continue;
			queryCounts.set(q, (queryCounts.get(q) ?? 0) + 1);
		}
		const topQueries = [...queryCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8)
			.map(([q]) => q);

		// Top categories: from brief themes + any source-category signal.
		const catCounts = new Map<string, number>();
		for (const b of brief.items) {
			for (const t of b.result.themes ?? []) {
				catCounts.set(t.name, (catCounts.get(t.name) ?? 0) + (t.count || 1));
			}
		}
		const topCategories = [...catCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 6)
			.map(([name, count]) => ({ name, count }));

		// Active span: first → last entry timestamp across both histories.
		const ts: number[] = [];
		for (const s of search.items) ts.push(new Date(s.createdAt).getTime());
		for (const b of brief.items) ts.push(new Date(b.createdAt).getTime());
		const activeSpanDays =
			ts.length >= 2
				? Math.max(
						1,
						Math.round((Math.max(...ts) - Math.min(...ts)) / 86_400_000),
					)
				: 0;

		return {
			totalSearches,
			keywordSearches,
			aiSearches,
			totalBriefs,
			topQueries,
			topCategories,
			activeSpanDays,
		};
	}

	// ── Internals ────────────────────────────────────────────────────────────

	/** Ensure the default profile row exists (migrate also seeds it). */
	private async ensureRow(): Promise<void> {
		const row = await this.db.db
			.select({ id: userProfile.id })
			.from(userProfile)
			.where(eq(userProfile.id, "default"))
			.get();
		if (!row) {
			await this.db.db.insert(userProfile).values({ id: "default" }).run();
		}
	}

	private toDto(row: {
		id: string;
		preferredUiLanguage: string;
		preferredIntelligenceLanguage: string;
		topics: string[];
		interests: string[];
		notificationSettings: Record<string, unknown>;
		aiPreferences: Record<string, unknown>;
		firstName: string | null;
		lastName: string | null;
		alias: string | null;
		customInstruction: string;
		behaviorSummary: string;
		summaryGeneratedAt: Date | null;
		createdAt: Date;
		updatedAt: Date;
	}): UserProfile {
		return {
			id: row.id,
			preferredUiLanguage: row.preferredUiLanguage,
			preferredIntelligenceLanguage: row.preferredIntelligenceLanguage,
			topics: row.topics as SourceCategory[],
			interests: row.interests,
			notificationSettings:
				row.notificationSettings as unknown as UserProfile["notificationSettings"],
			aiPreferences:
				row.aiPreferences as unknown as UserProfile["aiPreferences"],
			firstName: row.firstName,
			lastName: row.lastName,
			alias: row.alias,
			customInstruction: row.customInstruction,
			behaviorSummary: row.behaviorSummary,
			summaryGeneratedAt: row.summaryGeneratedAt,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		};
	}
}
