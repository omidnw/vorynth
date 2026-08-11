import { randomUUID } from "node:crypto";
import { createTestDb, type TestDb } from "../helpers/db.js";
import { IntelligenceService } from "../../src/modules/intelligence/intelligence.service.js";
import { ftsInsertArticle } from "../../src/db/fts-sync.js";
import { normalizeText } from "../../src/search/text-normalizer.js";
import type { LlmService } from "../../src/modules/llm/llm.service.js";
import type { NewsService } from "../../src/modules/news/news.service.js";
import type { HistoryService } from "../../src/modules/history/history.service.js";
import type { CrawlerService } from "../../src/modules/crawler/crawler.service.js";
import type { GenerateInput } from "../../src/modules/llm/llm-provider.js";
import type { Article, ArticleDetail } from "@vorynth/types";

/**
 * Per-story translate (v1.8.0) — `IntelligenceService.translateStory` powers the
 * reader's Translate button for a single story. It must reuse the exact write
 * path of the batch job (title → translation, `original_title` = first original,
 * `translated_content` = body, `content` untouched, FTS follows the title) and
 * stay idempotent: already-translated or empty-body stories never hit the LLM.
 */

function seedSource(db: TestDb, id = "src-translate-story"): void {
	db.service.rawDb
		.prepare(
			`INSERT INTO sources (id, name, url, type, category, adapter)
			 VALUES (?, 'Translate Story Source', 'https://example.com', 'rss', 'other', 'rss')`,
		)
		.run(id);
}

/** Insert one article (mirroring the crawler: also FTS-indexes it). */
function seedArticle(db: TestDb, sourceId: string, n: number): string {
	const raw = db.service.rawDb;
	const id = `art-${n}`;
	const title = `Original Title ${n}`;
	const content = `Original body ${n}. Some longer content to translate.`;
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
			`https://example.com/story-${n}`,
			randomUUID(),
			Date.now() - n * 1000,
			Date.now() - n * 1000,
		);
	ftsInsertArticle(raw, id, title, content);
	return id;
}

function row(
	db: TestDb,
	id: string,
): {
	title: string;
	original_title: string | null;
	content: string;
	translated_content: string | null;
} {
	return db.service.rawDb
		.prepare(
			"SELECT title, original_title, content, translated_content FROM articles WHERE id = ?",
		)
		.get(id) as {
		title: string;
		original_title: string | null;
		content: string;
		translated_content: string | null;
	};
}

/** Fake LlmService echoing a single-item "translation" + a NewsService stub. */
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
			return JSON.stringify(
				items.map((i) => ({
					id: i.id,
					title: `T:${i.id}`,
					content: `B:${i.id}`,
					...(i.insight
						? {
								insight: {
									summary: `S:${i.id}`,
									significance: `G:${i.id}`,
									impact: `I:${i.id}`,
									recommendedAction: `R:${i.id}`,
								},
							}
						: {}),
				})),
			);
		}),
		analyze: jest.fn(),
		summarize: jest.fn(),
		// v1.8.1 — canAutoAnalyze reads mode + provider availability.
		getMode: () => "news",
		isAvailable: jest.fn(async () => true),
	} as unknown as LlmService;

	// `translateStory` returns the refreshed ArticleDetail via NewsService —
	// stub it to read the row straight back out of the temp DB.
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
					sourceName: "Translate Story Source",
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
		llm: llm as unknown as {
			generate: jest.Mock;
			getMode: () => string;
			isAvailable: jest.Mock;
		},
		news: news as unknown as { getArticleDetail: jest.Mock },
	};
}

describe("translateStory", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
		seedSource(tdb);
	});

	afterEach(() => {
		tdb.close();
	});

	it("translates a single story and returns the refreshed detail", async () => {
		seedArticle(tdb, "src-translate-story", 1);

		const { svc, llm, news } = makeService(tdb);
		const detail = await svc.translateStory("art-1");

		// One LLM call with exactly this story, in the default profile language.
		expect(llm.generate).toHaveBeenCalledTimes(1);
		const input = llm.generate.mock.calls[0][0] as GenerateInput;
		expect(input.outputLanguage).toBe("en");
		expect(JSON.parse(input.user as string)).toEqual([
			{
				id: "art-1",
				title: "Original Title 1",
				content: "Original body 1. Some longer content to translate.",
			},
		]);

		// The write path mirrors the batch job exactly.
		const r = row(tdb, "art-1");
		expect(r.title).toBe("T:art-1");
		expect(r.original_title).toBe("Original Title 1");
		expect(r.translated_content).toBe("B:art-1");
		expect(r.content).toBe(
			"Original body 1. Some longer content to translate.",
		);

		// FTS follows the rewritten title; content is unchanged (R-A05).
		const fts = tdb.service.rawDb
			.prepare("SELECT title, content FROM articles_fts WHERE article_id = ?")
			.get("art-1") as { title: string; content: string };
		expect(fts.title).toBe(normalizeText("T:art-1"));

		// The reader receives the translated article back.
		expect(detail?.article.title).toBe("T:art-1");
		expect(detail?.article.originalTitle).toBe("Original Title 1");
		expect(detail?.article.translatedContent).toBe("B:art-1");
		expect(detail?.sourceName).toBe("Translate Story Source");
		expect(news.getArticleDetail).toHaveBeenCalledWith("art-1");
	});

	it("no-ops for an already-translated story — no LLM call", async () => {
		seedArticle(tdb, "src-translate-story", 1);
		tdb.service.rawDb
			.prepare(
				"UPDATE articles SET translated_content = ?, original_title = ? WHERE id = ?",
			)
			.run("old:art-1", "Original Title 1", "art-1");

		const { svc, llm } = makeService(tdb);
		const detail = await svc.translateStory("art-1");

		expect(llm.generate).not.toHaveBeenCalled();
		expect(detail?.article.translatedContent).toBe("old:art-1");
		expect(row(tdb, "art-1").title).toBe("Original Title 1");
	});

	it("does not translate a title already in the target script (v1.8.1)", async () => {
		// An untagged source + a Persian title, intelligence language = Persian.
		const raw = tdb.service.rawDb;
		raw
			.prepare(
				`INSERT INTO sources (id, name, url, type, category, adapter)
			 VALUES ('src-fa', 'FA', 'https://fa.example', 'rss', 'other', 'rss')`,
			)
			.run();
		raw
			.prepare(
				`INSERT INTO articles (id, source_id, title, content, url, hash)
			 VALUES ('art-fa', 'src-fa', 'آپدیت مهم منتشر شد', 'متن فارسی', 'https://fa.example/1', 'hash-fa')`,
			)
			.run();
		raw
			.prepare(
				"UPDATE user_profile SET preferred_intelligence_language = 'fa' WHERE id = 'default'",
			)
			.run();

		const { svc, llm } = makeService(tdb);
		const detail = await svc.translateStory("art-fa");

		// Same-script guard: the LLM is never called, the title stays as-is.
		expect(llm.generate).not.toHaveBeenCalled();
		expect(detail?.article.title).toBe("آپدیت مهم منتشر شد");
	});

	it("canAutoAnalyze gates on intelligence mode + provider (v1.8.1)", async () => {
		const { svc, llm } = makeService(tdb);

		// News mode → false even with a provider configured (R-A03).
		expect(await svc.canAutoAnalyze()).toBe(false);

		// Intelligence mode + provider → true.
		llm.getMode = () => "intelligence";
		expect(await svc.canAutoAnalyze()).toBe(true);

		// Provider missing → false even in intelligence mode.
		llm.isAvailable.mockResolvedValue(false);
		expect(await svc.canAutoAnalyze()).toBe(false);
	});

	it("re-translates an already-translated story when force is set", async () => {
		// The Re-translate pill / incomplete-translation repair force a fresh
		// translation even when a (bad) translation already exists.
		seedArticle(tdb, "src-translate-story", 1);
		tdb.service.rawDb
			.prepare(
				"UPDATE articles SET translated_content = ?, original_title = ? WHERE id = ?",
			)
			.run("bad-short", "Original Title 1", "art-1");

		const { svc, llm } = makeService(tdb);
		await svc.translateStory("art-1", { force: true });

		expect(llm.generate).toHaveBeenCalledTimes(1);
		expect(row(tdb, "art-1").translated_content).toBe("B:art-1");
		// original_title is preserved — it keeps the FIRST original forever.
		expect(row(tdb, "art-1").original_title).toBe("Original Title 1");
	});

	it("re-translates FROM the original title, never a previous translation", async () => {
		// After a first translation the story's `title` holds the translated
		// text and `original_title` the source. A language change + Re-translate
		// must feed the LLM the ORIGINAL title, or the re-translation garbles.
		seedArticle(tdb, "src-translate-story", 1);
		tdb.service.rawDb
			.prepare(
				"UPDATE articles SET translated_content = ?, original_title = ? WHERE id = ?",
			)
			.run("old-translation", "Original Title 1", "art-1");

		const { svc, llm } = makeService(tdb);
		await svc.translateStory("art-1", { force: true });

		const input = llm.generate.mock.calls[0][0] as GenerateInput;
		expect(JSON.parse(input.user as string)).toEqual([
			{
				id: "art-1",
				title: "Original Title 1", // the source, not "T:art-1"
				content: "Original body 1. Some longer content to translate.",
			},
		]);
	});

	it("skips a story whose source language already matches the target — no LLM call", async () => {
		// An English story with an English intelligence language is never sent
		// through a pointless English "translation" (the broken same-language
		// rewrite that garbled titles after a language change).
		seedArticle(tdb, "src-translate-story", 1);
		tdb.service.rawDb
			.prepare("UPDATE sources SET language = 'en' WHERE id = ?")
			.run("src-translate-story");

		const { svc, llm, news } = makeService(tdb);
		const detail = await svc.translateStory("art-1");

		expect(llm.generate).not.toHaveBeenCalled();
		expect(detail?.article.title).toBe("Original Title 1");
		expect(detail?.article.translatedContent).toBeNull();
		expect(news.getArticleDetail).toHaveBeenCalledWith("art-1");
	});

	it("still translates an untagged source (language unknown) in any target", async () => {
		// The source language is NULL → nothing to compare, translate as before.
		seedArticle(tdb, "src-translate-story", 1);

		const { svc, llm } = makeService(tdb);
		await svc.translateStory("art-1");

		expect(llm.generate).toHaveBeenCalledTimes(1);
		expect(row(tdb, "art-1").translated_content).toBe("B:art-1");
	});

	it("no-ops for an empty body when the title is already translated", async () => {
		seedArticle(tdb, "src-translate-story", 1);
		tdb.service.rawDb
			.prepare(
				"UPDATE articles SET content = '', original_title = ? WHERE id = ?",
			)
			.run("Original Title 1", "art-1");

		const { svc, llm } = makeService(tdb);
		const detail = await svc.translateStory("art-1");

		expect(llm.generate).not.toHaveBeenCalled();
		expect(detail?.article.title).toBe("Original Title 1");
	});

	it("translates the title of an empty-body story without fabricating a body", async () => {
		// A feed item with a title but no description (empty body) still carries
		// the pill — translating it rewrites the title and never invents a body
		// for content that doesn't exist (R-C04).
		seedArticle(tdb, "src-translate-story", 1);
		tdb.service.rawDb
			.prepare("UPDATE articles SET content = '' WHERE id = ?")
			.run("art-1");

		const { svc, llm } = makeService(tdb);
		const detail = await svc.translateStory("art-1");

		expect(llm.generate).toHaveBeenCalledTimes(1);
		const r = row(tdb, "art-1");
		expect(r.title).toBe("T:art-1");
		expect(r.original_title).toBe("Original Title 1");
		expect(r.translated_content).toBeNull();
		expect(r.content).toBe("");
		expect(detail?.article.translatedContent).toBeNull();
	});

	it("returns null for a missing article", async () => {
		const { svc, llm } = makeService(tdb);
		await expect(svc.translateStory("nope")).resolves.toBeNull();
		expect(llm.generate).not.toHaveBeenCalled();
	});

	it("skips the write when the model returns nothing valid", async () => {
		seedArticle(tdb, "src-translate-story", 1);

		const { svc, llm } = makeService(tdb);
		llm.generate.mockResolvedValueOnce("not json at all");

		const detail = await svc.translateStory("art-1");

		expect(llm.generate).toHaveBeenCalledTimes(1);
		expect(row(tdb, "art-1").title).toBe("Original Title 1");
		expect(row(tdb, "art-1").translated_content).toBeNull();
		// The detail is the unchanged article.
		expect(detail?.article.translatedContent).toBeNull();
	});

	it("rethrows an LLM failure so the UI can surface it — nothing written", async () => {
		seedArticle(tdb, "src-translate-story", 1);

		const { svc, llm } = makeService(tdb);
		llm.generate.mockRejectedValueOnce(new Error("rate limited"));

		await expect(svc.translateStory("art-1")).rejects.toThrow("rate limited");
		expect(row(tdb, "art-1").translated_content).toBeNull();
	});

	it("translates the story's AI insight into the target language (v1.8.0)", async () => {
		const id = seedArticle(tdb, "src-translate-story", 1);
		tdb.service.rawDb
			.prepare(
				`INSERT INTO ai_insights
				   (id, cluster_id, article_id, summary, significance, impact, recommended_action, importance_score, importance_tier, category, generated_language)
				 VALUES (?, NULL, ?, 'Summary EN', 'Sig EN', 'Impact EN', 'Action EN', 0.8, 'signal', 'other', 'en')`,
			)
			.run(`insight-${id}`, id);

		const { svc, llm } = makeService(tdb);
		await svc.translateStory(id);

		// The LLM prompt carried the insight text alongside title/body.
		const input = llm.generate.mock.calls[0][0] as GenerateInput;
		expect(JSON.parse(input.user as string)).toEqual([
			{
				id,
				title: "Original Title 1",
				content: "Original body 1. Some longer content to translate.",
				insight: {
					summary: "Summary EN",
					significance: "Sig EN",
					impact: "Impact EN",
					recommendedAction: "Action EN",
				},
			},
		]);

		const ins = tdb.service.rawDb
			.prepare(
				"SELECT summary, significance, impact, recommended_action, original_summary, original_significance, generated_language FROM ai_insights WHERE article_id = ?",
			)
			.get(id);
		expect(ins).toEqual({
			summary: "S:art-1",
			significance: "G:art-1",
			impact: "I:art-1",
			recommended_action: "R:art-1",
			// v1.8.0 — the ORIGINAL (pre-translation) insight text is preserved
			// on the first translation, mirroring the article's original_title.
			original_summary: "Summary EN",
			original_significance: "Sig EN",
			generated_language: "en",
		});
	});

	it("keeps the ORIGINAL insight forever across re-translations (v1.8.0)", async () => {
		const id = seedArticle(tdb, "src-translate-story", 1);
		tdb.service.rawDb
			.prepare(
				`INSERT INTO ai_insights
				   (id, cluster_id, article_id, summary, significance, impact, recommended_action, importance_score, importance_tier, category, generated_language, original_summary, original_significance, original_impact, original_recommended_action)
				 VALUES (?, NULL, ?, 'Translated text', 'Sig TR', 'Impact TR', 'Action TR', 0.8, 'signal', 'other', 'fa', 'Original EN', 'Sig EN', 'Impact EN', 'Action EN')`,
			)
			.run(`insight-${id}`, id);

		const { svc } = makeService(tdb);
		// Force a second re-translation (already translated → force skips the
		// fully-translated guard). The originals must stay untouched.
		await svc.translateStory(id, { force: true });

		const rowIns = tdb.service.rawDb
			.prepare(
				"SELECT original_summary, original_significance, original_impact, original_recommended_action FROM ai_insights WHERE article_id = ?",
			)
			.get(id);
		expect(rowIns).toEqual({
			original_summary: "Original EN",
			original_significance: "Sig EN",
			original_impact: "Impact EN",
			original_recommended_action: "Action EN",
		});
	});

	it("keeps BOTH titles searchable after translation (FTS dual-title, v1.8.0)", async () => {
		seedArticle(tdb, "src-translate-story", 1);
		const { svc } = makeService(tdb);
		await svc.translateStory("art-1");

		const search = (q: string) =>
			tdb.service.rawDb
				.prepare(
					"SELECT article_id FROM articles_fts WHERE articles_fts MATCH ?",
				)
				.all(q) as Array<{ article_id: string }>;

		// The translated title ("T:art-1" → token "art") matches…
		expect(search("art").some((h) => h.article_id === "art-1")).toBe(true);
		// …and the ORIGINAL source title ("Original Title 1" → token "original")
		// still finds the story too — the whole point of the dual-title index.
		expect(search("original").some((h) => h.article_id === "art-1")).toBe(true);
	});
});
