import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../db/database.service.js";
import { usageEvents } from "../../db/schema.js";
import type { UsageSummary } from "@vorynth/types";

/**
 * Records every LLM call (tokens + duration + ok/fail) and aggregates them
 * for the Settings usage panel.
 *
 * Token counts come from the provider's response metadata when available;
 * when a provider doesn't expose token counts, we estimate from text length
 * (4 chars ≈ 1 token) so the usage panel always has *some* signal.
 */
@Injectable()
export class UsageService {
	private readonly logger = new Logger("Usage");

	constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

	/**
	 * Insert one usage row. better-sqlite3 is synchronous, so a single INSERT
	 * costs microseconds — we await it both to trigger Drizzle's lazy executor
	 * (the builder only runs the statement when awaited/`.run()`) and to catch
	 * any error instead of swallowing it. Never throw out of here: usage is
	 * bookkeeping and must never break an analysis.
	 */
	async record(input: {
		operation: "analyze" | "summarize" | "search" | "verify" | "generate";
		providerKind: string;
		model?: string | null;
		promptTokens?: number;
		completionTokens?: number;
		/** Raw response text — used to estimate tokens when counts are missing. */
		responseText?: string;
		promptText?: string;
		durationMs: number;
		ok: boolean;
	}): Promise<void> {
		const promptTokens =
			input.promptTokens ??
			(input.promptText ? estimateTokens(input.promptText) : 0);
		const completionTokens =
			input.completionTokens ??
			(input.responseText ? estimateTokens(input.responseText) : 0);
		const totalTokens = promptTokens + completionTokens;

		try {
			await this.db.db.insert(usageEvents).values({
				id: randomUUID(),
				operation: input.operation,
				providerKind: input.providerKind,
				model: input.model ?? null,
				promptTokens,
				completionTokens,
				totalTokens,
				durationMs: Math.round(input.durationMs),
				ok: input.ok,
				createdAt: new Date(),
			});
		} catch (err) {
			this.logger.warn(`failed to record usage: ${String(err)}`);
		}
	}

	/** Aggregate the full history into the shape the Settings UI renders. */
	async summary(): Promise<UsageSummary> {
		const all = await this.db.db.select().from(usageEvents);
		if (all.length === 0) {
			return {
				totalRequests: 0,
				totalTokens: 0,
				promptTokens: 0,
				completionTokens: 0,
				failedRequests: 0,
				byOperation: {},
				byProvider: {},
				last30d: { requests: 0, tokens: 0 },
				windowStart: new Date().toISOString(),
			};
		}

		const byOperation: Record<string, { requests: number; tokens: number }> =
			{};
		const byProvider: Record<string, { requests: number; tokens: number }> = {};
		let totalTokens = 0;
		let promptTokens = 0;
		let completionTokens = 0;
		let failed = 0;
		let earliest = all[0]!.createdAt.getTime();
		const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
		let last30dRequests = 0;
		let last30dTokens = 0;

		for (const row of all) {
			totalTokens += row.totalTokens;
			promptTokens += row.promptTokens;
			completionTokens += row.completionTokens;
			if (!row.ok) failed += 1;
			if (row.createdAt.getTime() < earliest)
				earliest = row.createdAt.getTime();
			if (row.createdAt.getTime() >= thirtyDaysAgo) {
				last30dRequests += 1;
				last30dTokens += row.totalTokens;
			}

			byOperation[row.operation] ??= { requests: 0, tokens: 0 };
			byOperation[row.operation]!.requests += 1;
			byOperation[row.operation]!.tokens += row.totalTokens;

			byProvider[row.providerKind] ??= { requests: 0, tokens: 0 };
			byProvider[row.providerKind]!.requests += 1;
			byProvider[row.providerKind]!.tokens += row.totalTokens;
		}

		return {
			totalRequests: all.length,
			totalTokens,
			promptTokens,
			completionTokens,
			failedRequests: failed,
			byOperation,
			byProvider,
			last30d: { requests: last30dRequests, tokens: last30dTokens },
			windowStart: new Date(earliest).toISOString(),
		};
	}

	/** Reset usage history. */
	async reset(): Promise<void> {
		await this.db.db.delete(usageEvents);
	}
}

/** Rough token estimate (4 chars ≈ 1 token) for providers without metadata. */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}
