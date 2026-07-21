import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../../db/database.service.js";
import { articles, userProfile } from "../../db/schema.js";
import { LlmService } from "../llm/llm.service.js";
import { estimateTokens } from "../llm/usage.service.js";
import { HistoryService } from "../history/history.service.js";
import {
	extractCitedNumbers,
	resolveCitations,
	stripCitedLine,
} from "../intelligence/prompts/citations.js";
import { tokenizeQuery, buildFtsQuery } from "../../search/text-normalizer.js";
import type {
	Article,
	Citation,
	SearchHit,
	SearchResult,
} from "@vorynth/types";

/**
 * Search across collected articles via FTS5.
 *
 * Two modes:
 *   1. `keyword(q)`  — FTS5 MATCH over title + content. Uses BM25 ranking
 *                      (built into FTS5) and snippet() for highlights.
 *                      Tries AND first, falls back to OR for broad matches.
 *   2. `ask(q)`      — RAG: run keyword() to fetch the top-N relevant
 *                      articles, pack as many as fit under a token budget,
 *                      and hand them to the LLM as ground truth.
 *
 * Text normalization at both index time and query time uses:
 *   • @persian-tools/persian-tools — Persian character unification
 *   • Intl.Segmenter               — ICU-based word boundary detection
 *   • String.normalize('NFKC')     — Unicode normalization
 */
@Injectable()
export class SearchService {
	private readonly logger = new Logger("Search");

	constructor(
		@Inject(DatabaseService) private readonly db: DatabaseService,
		@Inject(LlmService) private readonly llm: LlmService,
		@Inject(HistoryService) private readonly history: HistoryService,
	) {}

	// ── Keyword search (FTS5) ─────────────────────────────────────────────

	/**
	 * Plain keyword search powered by FTS5.
	 *
	 * 1. Tokenize + normalize the query via Intl.Segmenter + persian-tools.
	 * 2. Build an FTS5 MATCH query — try implicit AND first.
	 * 3. If AND yields no results, fall back to OR.
	 * 4. Results are ordered by BM25 rank (built-in FTS5 scoring).
	 * 5. Snippets use FTS5's built-in snippet() function.
	 */
	async keyword(
		q: string,
		opts: { limit?: number; periodMs?: number } = {},
	): Promise<SearchResult> {
		const maxResults = Math.min(100, Math.max(1, opts.limit ?? 20));
		const tokens = tokenizeQuery(q);
		if (tokens.length === 0) return { query: q, hits: [], totalMatches: 0 };

		const ftsQuery = buildFtsQuery(tokens);
		if (!ftsQuery) return { query: q, hits: [], totalMatches: 0 };

		// Try AND first (implicit AND in FTS5 — just space-separated tokens)
		let hits = this.runFtsQuery(ftsQuery.andQuery, opts.periodMs);

		// Fall back to OR if AND produces nothing
		if (hits.length === 0) {
			hits = this.runFtsQuery(ftsQuery.orQuery, opts.periodMs);
		}

		// Slice to limit (runFtsQuery returns up to maxResults internally)
		const sliced = hits.slice(0, maxResults);

		const result: SearchResult = {
			query: q,
			hits: sliced,
			totalMatches: sliced.length,
		};

		if (this.history.shouldRecordKeyword()) {
			this.history.recordSearch({ query: q, mode: "keyword", result });
		}

		return result;
	}

	/**
	 * Execute an FTS5 MATCH query and return SearchHit[].
	 *
	 * Joins directly on the articles table (FTS5 stores article_id as an
	 * UNINDEXED column). An INNER JOIN naturally filters out articles that
	 * have been deleted. Duplicate entries (from force-crawl re-inserts) are
	 * deduplicated in-memory — the first (highest-ranked) entry per article
	 * wins.
	 *
	 * FTS5's `rank` column provides BM25 relevance scores. `snippet()` with
	 * column index 1 (title) gives context-highlighted excerpts.
	 */
	private runFtsQuery(
		ftsQuery: string,
		periodMs?: number,
		limit = 100,
	): SearchHit[] {
		const since = periodMs ? Date.now() - periodMs : null;

		const rows = this.db.rawDb
			.prepare(
				`\
	SELECT a.id            AS a_id,
	       a.source_id     AS a_source_id,
	       a.title         AS a_title,
	       a.content       AS a_content,
	       a.url           AS a_url,
	       a.author        AS a_author,
	       a.published_at  AS a_published_at,
	       a.collected_at  AS a_collected_at,
	       a.hash          AS a_hash,
	       fts.rank        AS fts_rank,
	       snippet(articles_fts, 1, '…', '…', '…', 64) AS fts_highlight
	FROM articles_fts fts
	JOIN articles a ON a.id = fts.article_id
	WHERE articles_fts MATCH ?
	  AND (? IS NULL OR a.collected_at >= ?)
	ORDER BY fts.rank
	LIMIT ?`,
			)
			.all(ftsQuery, since, since, limit) as FtsRow[];

		// Deduplicate by article_id: keep the first (highest-ranked) entry
		// when the same article appears multiple times (force-crawl re-insert).
		const seen = new Set<string>();
		const hits: SearchHit[] = [];
		for (const row of rows) {
			if (seen.has(row.a_id)) continue;
			seen.add(row.a_id);
			hits.push(toSearchHit(row));
		}
		return hits;
	}

	// ── AI-assisted search (RAG) ──────────────────────────────────────────

	/**
	 * AI-assisted search (RAG).
	 *
	 * 1. Pull the top articles matching the query via FTS5 keyword.
	 * 2. Pack them into a context window budget (default 24K).
	 * 3. Ask the LLM to answer using ONLY those articles, citing [N] ids.
	 * 4. Return the answer + cited articles.
	 *
	 * In news mode (no LLM) it falls back to plain keyword search.
	 */
	async ask(
		q: string,
		opts: { contextTokenBudget?: number; periodMs?: number } = {},
	): Promise<{
		query: string;
		answer: string;
		citations: Citation[];
		hits: SearchHit[];
		tokensUsed: number;
	}> {
		const budget = opts.contextTokenBudget ?? 24_000;
		const intelligenceEnabled = await this.llm.isAvailable();
		const keywordResult = await this.keyword(q, {
			limit: 40,
			periodMs: opts.periodMs,
		});

		if (!intelligenceEnabled || keywordResult.hits.length === 0) {
			return {
				query: q,
				answer: intelligenceEnabled
					? "No matching articles found for that question."
					: "News mode — add an LLM provider in Settings to ask questions over your stories.",
				citations: [],
				hits: keywordResult.hits,
				tokensUsed: 0,
			};
		}

		// Pack articles under the token budget, fairly truncated.
		const packed = packContext(keywordResult.hits, budget);
		const contextText = packed
			.map(
				(h, i) =>
					`[${i + 1}] id=${h.article.id}\nTITLE: ${h.article.title}\n${truncate(h.article.content, 2000)}`,
			)
			.join("\n\n---\n\n");

		const user = [
			`QUESTION:\n${q}`,
			"",
			"Answer using ONLY the article context below. Cite each claim with",
			"the article's [N] number, e.g. 'OpenAI released a new model [1] that",
			"outperforms Gemini on reasoning [3].' If the context doesn't contain",
			"the answer, say so plainly. Be terse and precise.",
			"",
			`CONTEXT:\n${contextText}`,
		].join("\n");

		// Bias the answer by the user's custom instruction.
		const customInstruction = this.readCustomInstruction();

		// Citation resolution context.
		const citeContext = packed.map((h) => ({
			articleId: h.article.id,
			title: h.article.title,
			sourceName: "collected",
			url: h.article.url,
			publishedAt: h.article.publishedAt
				? new Date(h.article.publishedAt).toISOString().slice(0, 10)
				: null,
		}));

		try {
			const { draft, usage } = await this.llm.invokeWithBudget<string>(
				"search",
				async (provider) => {
					const result = await provider.analyze({
						articleTitle: q,
						articleContent: customInstruction
							? `READER DIRECTIVE: ${customInstruction}\n\n${user}`
							: user,
						outputLanguage: this.readIntelligenceLanguage(),
					});
					return `${result.summary}\n\n${result.significance}`;
				},
			);

			const answer = stripCitedLine(draft);
			const numbers = extractCitedNumbers(answer);
			const citations = resolveCitations(numbers, citeContext);
			const citedIds = new Set(citations.map((c) => c.articleId));

			const askResult = {
				query: q,
				answer,
				citations,
				hits: keywordResult.hits.filter((h) => citedIds.has(h.article.id)),
				tokensUsed: usage.totalTokens,
			};

			if (this.history.shouldRecordAi()) {
				this.history.recordSearch({ query: q, mode: "ai", result: askResult });
			}

			return askResult;
		} catch (err) {
			this.logger.warn(`AI search failed: ${(err as Error).message}`);
			return {
				query: q,
				answer: `Search failed: ${(err as Error).message}`,
				citations: [],
				hits: keywordResult.hits.slice(0, 5),
				tokensUsed: 0,
			};
		}
	}

	/**
	 * Read the user's custom instruction from the profile row (synchronous —
	 * better-sqlite3).
	 */
	private readCustomInstruction(): string {
		const row = this.db.db
			.select({ ci: userProfile.customInstruction })
			.from(userProfile)
			.where(eq(userProfile.id, "default"))
			.get();
		return (row?.ci ?? "").trim();
	}

	/**
	 * Read the user's preferred intelligence language from the profile row
	 * (synchronous — better-sqlite3). Falls back to "en".
	 */
	private readIntelligenceLanguage(): string {
		const row = this.db.db
			.select({ lang: userProfile.preferredIntelligenceLanguage })
			.from(userProfile)
			.where(eq(userProfile.id, "default"))
			.get();
		return (row?.lang ?? "en").trim() || "en";
	}
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Schema of a raw row returned by the FTS5 query. */
interface FtsRow {
	a_id: string;
	a_source_id: string;
	a_title: string;
	a_content: string;
	a_url: string;
	a_author: string | null;
	a_published_at: number | null;
	a_collected_at: number;
	a_hash: string;
	fts_rank: number;
	fts_highlight: string;
}

function toSearchHit(row: FtsRow): SearchHit {
	return {
		article: toArticleDto(row),
		score: Math.round(row.fts_rank * 100) / 100,
		highlight: row.fts_highlight,
	};
}

function toArticleDto(row: FtsRow): Article {
	return {
		id: row.a_id,
		sourceId: row.a_source_id,
		title: row.a_title,
		content: row.a_content,
		url: row.a_url,
		author: row.a_author,
		publishedAt: row.a_published_at ? new Date(row.a_published_at) : null,
		collectedAt: new Date(row.a_collected_at),
		hash: row.a_hash,
	};
}

function truncate(s: string, max: number): string {
	return s.length > max ? s.slice(0, max).trimEnd() + "…" : s;
}

/**
 * Pack as many hits as fit under the token budget, fairly truncating each.
 * Always includes at least the top hit.
 */
function packContext(hits: SearchHit[], budgetTokens: number): SearchHit[] {
	const packed: SearchHit[] = [];
	let used = 0;
	for (const h of hits) {
		const approx =
			estimateTokens(`${h.article.title} ${h.article.content}`) + 50;
		if (used + approx > budgetTokens && packed.length > 0) break;
		packed.push(h);
		used += approx;
	}
	return packed;
}
