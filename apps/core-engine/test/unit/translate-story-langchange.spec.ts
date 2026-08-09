import { randomUUID } from "node:crypto";
import { createTestDb, type TestDb } from "../helpers/db.js";
import { IntelligenceService } from "../../src/modules/intelligence/intelligence.service.js";
import { ftsInsertArticle } from "../../src/db/fts-sync.js";
import type { LlmService } from "../../src/modules/llm/llm.service.js";
import type { NewsService } from "../../src/modules/news/news.service.js";
import type { HistoryService } from "../../src/modules/history/history.service.js";
import type { CrawlerService } from "../../src/modules/crawler/crawler.service.js";
import type { GenerateInput } from "../../src/modules/llm/llm-provider.js";
import type { Article, ArticleDetail } from "@vorynth/types";

/**
 * User-observed regression candidate (v1.8.0): a story translated into one
 * language (ja) then Re-translated after switching the intelligence language
 * (zh) appeared unchanged. This spec reproduces that exact flow against the
 * engine — English source → translate to ja → switch profile language to zh →
 * `translateStory(id, { force: true })` — and pins the contract: the second
 * pass MUST hit the LLM with `outputLanguage: "zh"`, rewrite title/body, and
 * translate the insight, all while preserving the ORIGINAL English title and
 * insight (v1.8.0 original_* capture).
 */

function seedSource(db: TestDb, id = "src-langchange"): void {
	db.service.rawDb
		.prepare(
			`INSERT INTO sources (id, name, url, type, category, adapter, language)
			 VALUES (?, 'Lang Change Source', 'https://example.com', 'rss', 'other', 'rss', 'en')`,
		)
		.run(id);
}

/** Insert a story whose body is long enough to require chunked translation. */
function seedLongArticle(db: TestDb, sourceId: string, length: number): string {
	const raw = db.service.rawDb;
	const id = "art-long";
	const title = "Long Original Title";
	const content = "Long paragraph start. "
		.repeat(Math.ceil(length / 20))
		.slice(0, length);
	raw
		.prepare(
			`INSERT INTO articles (id, source_id, title, content, url, hash, published_at, collected_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(
			id,
			sourceId,
			title,
			content,
			"https://example.com/long",
			randomUUID(),
			Date.now() - 1000,
			Date.now() - 1000,
		);
	ftsInsertArticle(raw, id, title, content);
	return id;
}

function seedArticle(db: TestDb, sourceId: string): string {
	const raw = db.service.rawDb;
	const id = "art-langchange";
	const title = "Original English Title";
	const content =
		"Original English body. With a longer paragraph to translate.";
	raw
		.prepare(
			`INSERT INTO articles (id, source_id, title, content, url, hash, published_at, collected_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(
			id,
			sourceId,
			title,
			content,
			"https://example.com/story",
			randomUUID(),
			Date.now() - 1000,
			Date.now() - 1000,
		);
	ftsInsertArticle(raw, id, title, content);

	// The story already has an AI insight in the source language (en).
	raw
		.prepare(
			`INSERT INTO ai_insights
			   (id, cluster_id, article_id, summary, significance, impact, recommended_action, importance_score, importance_tier, category, generated_language)
			 VALUES (?, NULL, ?, 'EN Summary', 'EN Significance', 'EN Impact', 'EN Action', 0.8, 'signal', 'other', 'en')`,
		)
		.run(`insight-${id}`, id);
	return id;
}

/** Set the profile's preferred intelligence language (what ProfilePage writes). */
function setLanguage(db: TestDb, code: string): void {
	db.service.rawDb
		.prepare(
			"UPDATE user_profile SET preferred_intelligence_language = ? WHERE id = 'default'",
		)
		.run(code);
}

/**
 * Fake LlmService echoing a single-item translation whose output is keyed by
 * the requested `outputLanguage` — so the test can tell WHICH language each
 * call was asked for, and prove a language change actually reaches the model.
 * The echoed text uses REAL script characters per language (Japanese kana,
 * Chinese hanzi, Korean hangul) so the engine's wrong-language guard sees a
 * genuine match/mismatch, not a bracketed tag.
 */
function makeService(tdb: TestDb) {
	const llm = {
		generate: jest.fn(async (input: GenerateInput) => {
			const items = JSON.parse(input.user) as Array<{
				id: string;
				title: string;
				content: string;
				insight?: {
					summary: string;
					significance: string;
					impact: string;
					recommendedAction: string;
				};
			}>;
			const lang = input.outputLanguage;
			const script =
				lang === "ja"
					? "あ"
					: lang === "zh"
						? "汉"
						: lang === "ko"
							? "한"
							: lang === "fa"
								? "فا"
								: lang;
			return JSON.stringify(
				items.map((i) => ({
					id: i.id,
					title: `${script} T:${i.id}`,
					content: `${script} B:${i.id}`,
					...(i.insight
						? {
								insight: {
									summary: `${script} S:${i.id}`,
									significance: `${script} G:${i.id}`,
									impact: `${script} I:${i.id}`,
									recommendedAction: `${script} R:${i.id}`,
								},
							}
						: {}),
				})),
			);
		}),
		analyze: jest.fn(),
		summarize: jest.fn(),
	} as unknown as LlmService;

	const news = {
		getArticleDetail: jest.fn(
			async (id: string): Promise<ArticleDetail | null> => {
				const r = tdb.service.rawDb
					.prepare(
						"SELECT id, source_id, title, original_title, content, translated_content, url, author, published_at, collected_at, hash FROM articles WHERE id = ?",
					)
					.get(id) as
					| {
							id: string;
							source_id: string;
							title: string;
							original_title: string | null;
							content: string;
							translated_content: string | null;
							url: string;
							author: string | null;
							published_at: number;
							collected_at: number;
							hash: string;
					  }
					| undefined;
				if (!r) return null;
				const article: Article = {
					id: r.id,
					sourceId: r.source_id,
					title: r.title,
					originalTitle: r.original_title,
					content: r.content,
					translatedContent: r.translated_content,
					url: r.url,
					author: r.author,
					publishedAt: r.published_at ? new Date(r.published_at) : null,
					collectedAt: new Date(r.collected_at),
					hash: r.hash,
				};
				return {
					article,
					sourceName: "Lang Change Source",
					sourceCategory: "other",
				};
			},
		),
	} as unknown as NewsService;

	const svc = new IntelligenceService(
		tdb.service,
		llm,
		news,
		undefined as unknown as HistoryService,
		{} as unknown as CrawlerService,
	);
	return {
		svc,
		llm: llm as unknown as { generate: jest.Mock },
	};
}

describe("translateStory — language change + Re-translate (v1.8.0)", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
		seedSource(tdb);
	});

	afterEach(() => {
		tdb.close();
	});

	it("re-translates into the NEW language after a language change (ja → zh)", async () => {
		const id = seedArticle(tdb, "src-langchange");

		const { svc, llm } = makeService(tdb);

		// Pass 1: user's language is Japanese → translate.
		setLanguage(tdb, "ja");
		await svc.translateStory(id);
		expect(llm.generate).toHaveBeenCalledTimes(1);
		expect(
			(llm.generate.mock.calls[0][0] as GenerateInput).outputLanguage,
		).toBe("ja");

		// The first pass translated title/body AND the insight, and captured the
		// ORIGINAL English text (title + insight) for the show-original toggle.
		let r = tdb.service.rawDb
			.prepare(
				"SELECT title, original_title, translated_content FROM articles WHERE id = ?",
			)
			.get(id) as {
			title: string;
			original_title: string | null;
			translated_content: string | null;
		};
		expect(r.title).toBe("あ T:art-langchange");
		expect(r.original_title).toBe("Original English Title");
		expect(r.translated_content).toBe("あ B:art-langchange");

		// Pass 2: user switches the intelligence language to Chinese and hits
		// Re-translate (force). The engine MUST call the model with "zh".
		setLanguage(tdb, "zh");
		await svc.translateStory(id, { force: true });

		expect(llm.generate).toHaveBeenCalledTimes(2);
		const second = llm.generate.mock.calls[1][0] as GenerateInput;
		expect(second.outputLanguage).toBe("zh");
		// It translates FROM the ORIGINAL English title, never the Japanese one.
		expect(JSON.parse(second.user as string)).toEqual([
			{
				id,
				title: "Original English Title",
				content: "Original English body. With a longer paragraph to translate.",
				insight: {
					summary: "あ S:art-langchange",
					significance: "あ G:art-langchange",
					impact: "あ I:art-langchange",
					recommendedAction: "あ R:art-langchange",
				},
			},
		]);

		// The stored story is now the Chinese translation — NOT the Japanese one.
		r = tdb.service.rawDb
			.prepare(
				"SELECT title, original_title, translated_content FROM articles WHERE id = ?",
			)
			.get(id) as {
			title: string;
			original_title: string | null;
			translated_content: string | null;
		};
		expect(r.title).toBe("汉 T:art-langchange");
		expect(r.original_title).toBe("Original English Title");
		expect(r.translated_content).toBe("汉 B:art-langchange");

		// The insight followed the story into Chinese too (articles AND insights
		// re-translate together), with the English original preserved forever.
		const ins = tdb.service.rawDb
			.prepare(
				"SELECT summary, significance, impact, recommended_action, original_summary, original_significance, generated_language FROM ai_insights WHERE article_id = ?",
			)
			.get(id);
		expect(ins).toEqual({
			summary: "汉 S:art-langchange",
			significance: "汉 G:art-langchange",
			impact: "汉 I:art-langchange",
			recommended_action: "汉 R:art-langchange",
			original_summary: "EN Summary",
			original_significance: "EN Significance",
			generated_language: "zh",
		});
	});

	it("re-translates the insight ALONE when the model returns it in the wrong language (v1.8.0)", async () => {
		// Real-world failure: on a very long article the model returns title+body
		// in the target language but the insight unchanged from its previous
		// language. The engine must detect that and retry the insight on its own
		// (a small, reliable ask) instead of storing a wrong-language insight.
		const id = seedArticle(tdb, "src-langchange");
		setLanguage(tdb, "ko");

		// The insight is currently Chinese (previous language).
		tdb.service.rawDb
			.prepare(
				`UPDATE ai_insights SET
				   summary = '亚马逊云科技 中文摘要', significance = '中文意义',
				   impact = '中文影响', recommended_action = '中文行动',
				   generated_language = 'zh', original_summary = 'EN Summary',
				   original_significance = 'EN Significance' WHERE article_id = ?`,
			)
			.run(id);

		const llm = {
			// Call 1: full story translation — title/body come back Korean, but
			// the insight stays CHINESE (the bug).
			// Call 2: insight-only fallback — now the insight is Korean.
			generate: jest
				.fn()
				.mockImplementationOnce(async (input: GenerateInput) => {
					const items = JSON.parse(input.user as string) as Array<{
						id: string;
						title: string;
						content: string;
						insight?: {
							summary: string;
							significance: string;
							impact: string;
							recommendedAction: string;
						};
					}>;
					return JSON.stringify(
						items.map((i) => ({
							id: i.id,
							title: "한 T:" + i.id,
							content: "한 B:" + i.id,
							// insight returned in the WRONG language (Chinese)
							insight: {
								summary: "亚马逊云科技 中文摘要",
								significance: "中文意义",
								impact: "中文影响",
								recommendedAction: "中文行动",
							},
						})),
					);
				})
				.mockImplementationOnce(async (input: GenerateInput) => {
					// The insight-only prompt asks for a bare object.
					const obj = JSON.parse(input.user as string);
					return JSON.stringify({
						summary: "한 S:" + obj.summary.slice(0, 4),
						significance: "한 G",
						impact: "한 I",
						recommendedAction: "한 R",
					});
				}),
			analyze: jest.fn(),
			summarize: jest.fn(),
		} as unknown as LlmService;

		const news = {
			getArticleDetail: jest.fn(async () => null),
		} as unknown as NewsService;

		const svc = new IntelligenceService(
			tdb.service,
			llm,
			news,
			undefined as unknown as HistoryService,
			{} as unknown as CrawlerService,
		);

		await svc.translateStory(id, { force: true });

		// Two LLM calls: the story pass + the insight-only fallback.
		expect((llm.generate as jest.Mock).mock.calls.length).toBe(2);
		// The fallback wrote the KOREAN insight, not the stale Chinese one.
		const ins = tdb.service.rawDb
			.prepare(
				"SELECT summary, significance, impact, recommended_action, generated_language FROM ai_insights WHERE article_id = ?",
			)
			.get(id) as {
			summary: string;
			significance: string;
			impact: string;
			recommended_action: string;
			generated_language: string;
		};
		// The summary is the Korean-marked translation of the Chinese text (the
		// exact slice length doesn't matter — the language stamp and script do).
		expect(ins.summary.startsWith("한 S:")).toBe(true);
		expect(ins.significance).toBe("한 G");
		expect(ins.impact).toBe("한 I");
		expect(ins.recommended_action).toBe("한 R");
		expect(ins.generated_language).toBe("ko");
	});

	it("splits a very long body into multiple LLM requests and stitches the translation (v1.8.0)", async () => {
		// A 16K-char body would make the model cut corners (translate the start,
		// return the tail unchanged). The engine must split the content into
		// chunks and send one request per chunk, then stitch the result.
		const id = seedLongArticle(tdb, "src-langchange", 16_000);
		setLanguage(tdb, "zh");

		const llm = {
			generate: jest.fn(async (input: GenerateInput) => {
				const items = JSON.parse(input.user as string) as Array<{
					id: string;
					content: string;
				}>;
				return JSON.stringify(
					items.map((i) => ({
						id: i.id,
						title: "汉 T:" + i.id,
						content: "汉 B:" + i.id + "(" + i.content.length + ")",
					})),
				);
			}),
			analyze: jest.fn(),
			summarize: jest.fn(),
		} as unknown as LlmService;
		const news = {
			getArticleDetail: jest.fn(async () => null),
		} as unknown as NewsService;
		const svc = new IntelligenceService(
			tdb.service,
			llm,
			news,
			undefined as unknown as HistoryService,
			{} as unknown as CrawlerService,
		);

		await svc.translateStory(id, { force: true });

		// More than one LLM call (chunk 1 = title + first part + insight, then
		// one call per remaining chunk).
		const calls = (llm.generate as jest.Mock).mock.calls.length;
		expect(calls).toBeGreaterThan(1);

		// The stored body is the stitched translation of ALL chunks — the mock
		// marks each chunk's content with its source length, so the presence of
		// every chunk's marker proves nothing was dropped.
		const row = tdb.service.rawDb
			.prepare("SELECT translated_content FROM articles WHERE id = ?")
			.get(id) as { translated_content: string | null };
		expect(row.translated_content).toContain("(5982)");
		expect(row.translated_content).toContain("(5984)");
		expect(row.translated_content).toContain("(4034)");
	});
});
