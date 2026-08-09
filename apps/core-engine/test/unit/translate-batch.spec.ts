import { randomUUID } from "node:crypto";
import { createTestDb, type TestDb } from "../helpers/db.js";
import { IntelligenceService } from "../../src/modules/intelligence/intelligence.service.js";
import { ftsInsertArticle } from "../../src/db/fts-sync.js";
import { normalizeText } from "../../src/search/text-normalizer.js";
import { parseTranslationBatch } from "../../src/modules/intelligence/prompts/translation.prompt.js";
import type { LlmService } from "../../src/modules/llm/llm.service.js";
import type { NewsService } from "../../src/modules/news/news.service.js";
import type { HistoryService } from "../../src/modules/history/history.service.js";
import type { CrawlerService } from "../../src/modules/crawler/crawler.service.js";
import type { GenerateInput } from "../../src/modules/llm/llm-provider.js";

/**
 * Translate Stories batch job (v1.7.0).
 *
 * `translateAllStories` sends 5 stories per LLM request and applies the JSON
 * array response back. `content` stays the canonical original (R-A05) — the
 * translation lands in `translated_content`, titles follow the existing
 * pattern (`title` = translation, `original_title` = first original), and the
 * FTS index follows the rewritten title. Runs against the throwaway temp-DB
 * harness with a stubbed `LlmService.generate`.
 */

function seedSource(db: TestDb, id = "src-translate"): void {
	db.service.rawDb
		.prepare(
			`INSERT INTO sources (id, name, url, type, category, adapter)
			 VALUES (?, 'Translate Test Source', 'https://example.com', 'rss', 'other', 'rss')`,
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
			// Distinct descending timestamps so `ORDER BY collected_at DESC`
			// deterministically returns art-1 (newest) … art-12 (oldest).
			Date.now() - n * 1000,
		);
	ftsInsertArticle(raw, id, title, content);
	return id;
}

/** Fake LlmService whose generate echoes every batch item as a "translation". */
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
		isAvailable: jest.fn(async () => true),
	} as unknown as LlmService;
	const svc = new IntelligenceService(
		tdb.service,
		llm,
		undefined as unknown as NewsService,
		undefined as unknown as HistoryService,
		{} as unknown as CrawlerService,
	);
	return { svc, llm: llm as unknown as { generate: jest.Mock } };
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

describe("translateAllStories", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
		seedSource(tdb);
	});

	afterEach(() => {
		tdb.close();
	});

	it("sends 5 stories per request and writes title + translated body, leaving content untouched", async () => {
		for (let n = 1; n <= 12; n++) seedArticle(tdb, "src-translate", n);

		const { svc, llm } = makeService(tdb);
		const progress: Array<[number, number]> = [];
		const translated = await svc.translateAllStories(
			(done, total) => progress.push([done, total]),
			"fa",
		);

		expect(translated).toBe(12);
		expect(progress[progress.length - 1]).toEqual([12, 12]);

		// 12 stories → 3 calls, batch sizes 5 / 5 / 2.
		const calls = llm.generate.mock.calls.map(
			(c) => JSON.parse(c[0].user as string) as Array<{ id: string }>,
		);
		expect(calls.map((c) => c.length)).toEqual([5, 5, 2]);
		// Every id appears in exactly one batch, in order.
		expect(calls.flat().map((i) => i.id)).toEqual(
			Array.from({ length: 12 }, (_, n) => `art-${n + 1}`),
		);

		for (let n = 1; n <= 12; n++) {
			const id = `art-${n}`;
			const r = row(tdb, id);
			expect(r.title).toBe(`T:${id}`);
			expect(r.original_title).toBe(`Original Title ${n}`);
			expect(r.translated_content).toBe(`B:${id}`);
			// The canonical original body is never overwritten (R-A05).
			expect(r.content).toBe(
				`Original body ${n}. Some longer content to translate.`,
			);
		}

		// FTS follows the rewritten title; content is unchanged.
		const fts = tdb.service.rawDb
			.prepare("SELECT title, content FROM articles_fts WHERE article_id = ?")
			.get("art-1") as { title: string; content: string };
		expect(fts.title).toBe(normalizeText("T:art-1"));
		expect(fts.content).toBe(
			normalizeText("Original body 1. Some longer content to translate."),
		);
	});

	it("skips a malformed response batch without crashing and keeps the rest", async () => {
		for (let n = 1; n <= 10; n++) seedArticle(tdb, "src-translate", n);

		const { svc, llm } = makeService(tdb);
		// First batch returns garbage; the rest are valid.
		llm.generate.mockImplementationOnce(async () => "not json at all, sorry");

		const translated = await svc.translateAllStories(undefined, "fa");

		// 10 stories → 2 batches; batch 1 (5 stories) lost, batch 2 (5) applied.
		expect(translated).toBe(5);
		for (let n = 1; n <= 5; n++)
			expect(row(tdb, `art-${n}`).translated_content).toBeNull();
		for (let n = 6; n <= 10; n++)
			expect(row(tdb, `art-${n}`).translated_content).toBe(`B:art-${n}`);
	});

	it("is idempotent — already-translated stories are excluded by the query", async () => {
		for (let n = 1; n <= 8; n++) seedArticle(tdb, "src-translate", n);
		// Mark 3 as already translated (as a previous run would have).
		for (const id of ["art-1", "art-2", "art-3"]) {
			tdb.service.rawDb
				.prepare("UPDATE articles SET translated_content = ? WHERE id = ?")
				.run(`old:${id}`, id);
		}

		const { svc, llm } = makeService(tdb);
		const translated = await svc.translateAllStories(undefined, "fa");

		// Only the 5 untranslated remain → exactly one batch of 5.
		expect(translated).toBe(5);
		expect(llm.generate.mock.calls).toHaveLength(1);
		expect(row(tdb, "art-1").translated_content).toBe("old:art-1");
		expect(row(tdb, "art-8").translated_content).toBe("B:art-8");
	});

	it("preserves the first original_title forever on re-translation", async () => {
		seedArticle(tdb, "src-translate", 1);
		// The old title job already translated the title but not the body.
		tdb.service.rawDb
			.prepare("UPDATE articles SET title = ?, original_title = ? WHERE id = ?")
			.run("Old Translated Title", "Original Title 1", "art-1");

		const { svc } = makeService(tdb);
		const translated = await svc.translateAllStories(undefined, "fa");

		expect(translated).toBe(1);
		const r = row(tdb, "art-1");
		expect(r.title).toBe("T:art-1");
		expect(r.original_title).toBe("Original Title 1"); // untouched
		expect(r.translated_content).toBe("B:art-1");
	});

	it("translates each story's AI insight alongside the title/body (v1.8.0)", async () => {
		const id = seedArticle(tdb, "src-translate", 1);
		tdb.service.rawDb
			.prepare(
				`INSERT INTO ai_insights
				   (id, cluster_id, article_id, summary, significance, impact, recommended_action, importance_score, importance_tier, category, generated_language)
				 VALUES (?, NULL, ?, 'Summary EN', 'Sig EN', 'Impact EN', 'Action EN', 0.7, 'signal', 'other', 'en')`,
			)
			.run(`insight-${id}`, id);

		const { svc } = makeService(tdb);
		const translated = await svc.translateAllStories(undefined, "fa");

		expect(translated).toBe(1);
		const ins = tdb.service.rawDb
			.prepare(
				"SELECT summary, significance, impact, recommended_action, original_summary, generated_language FROM ai_insights WHERE article_id = ?",
			)
			.get(id);
		expect(ins).toEqual({
			summary: "S:art-1",
			significance: "G:art-1",
			impact: "I:art-1",
			recommended_action: "R:art-1",
			// v1.8.0 — the batch preserves the ORIGINAL insight text on the
			// first translation, exactly like the per-story path.
			original_summary: "Summary EN",
			generated_language: "fa",
		});
	});

	it("re-translates already-translated stories when retranslateAll is set (v1.8.0)", async () => {
		// The user changed their intelligence language: existing translations
		// were made from the ORIGINAL text, so the whole collection must be
		// rewritten into the new language — not just the never-translated
		// backlog. `retranslateAll` widens the WHERE clause to include stories
		// that already carry a translation.
		const id = seedArticle(tdb, "src-translate", 1);
		tdb.service.rawDb
			.prepare(
				"UPDATE articles SET translated_content = 'old:fa', original_title = ? WHERE id = ?",
			)
			.run("Original Title 1", id);

		const { svc, llm } = makeService(tdb);
		const translated = await svc.translateAllStories(
			undefined,
			"ko",
			0,
			undefined,
			{
				retranslateAll: true,
			},
		);

		// The already-translated story was included and rewritten.
		expect(translated).toBe(1);
		expect(llm.generate).toHaveBeenCalledTimes(1);
		const r = row(tdb, id);
		expect(r.translated_content).toBe("B:art-1");
		// original_title stays the FIRST original forever.
		expect(r.original_title).toBe("Original Title 1");
	});
});

describe("parseTranslationBatch", () => {
	it("parses a clean JSON array", () => {
		const out = parseTranslationBatch(
			'[{"id":"a","title":"T","content":"C"},{"id":"b","title":"T2","content":"C2"}]',
		);
		expect(out).toEqual([
			{ id: "a", title: "T", content: "C" },
			{ id: "b", title: "T2", content: "C2" },
		]);
	});

	it("parses an optional insight object per item (v1.8.0)", () => {
		const out = parseTranslationBatch(
			JSON.stringify([
				{
					id: "a",
					title: "T",
					content: "C",
					insight: {
						summary: "S",
						significance: "G",
						impact: "I",
						recommendedAction: "R",
					},
				},
				{ id: "b", title: "T2", content: "C2" },
			]),
		);
		expect(out[0].insight).toEqual({
			summary: "S",
			significance: "G",
			impact: "I",
			recommendedAction: "R",
		});
		// A story without an insight has no insight key on its entry.
		expect(out[1].insight).toBeUndefined();
	});

	it("drops a malformed insight but keeps the story translation", () => {
		const out = parseTranslationBatch(
			'[{"id":"a","title":"T","content":"C","insight":"not-an-object"},{"id":"b","title":"T2","content":"C2","insight":{"summary":"only"}}]',
		);
		// A non-object insight is ignored entirely…
		expect(out[0].insight).toBeUndefined();
		// …while a summary-bearing insight is kept (optional fields empty are
		// fine — the write path merges them with the stored values, R-C04).
		expect(out[1].insight).toEqual({
			summary: "only",
			significance: "",
			impact: "",
			recommendedAction: "",
		});
		expect(out[1].title).toBe("T2");
	});

	it("strips code fences and surrounding prose", () => {
		const out = parseTranslationBatch(
			'Here you go:\n```json\n[{"id":"a","title":"T","content":"C"}]\n```\nHope that helps!',
		);
		expect(out).toEqual([{ id: "a", title: "T", content: "C" }]);
	});

	it("drops entries with missing ids or empty fields", () => {
		const out = parseTranslationBatch(
			'[{"id":"a","title":"","content":"C"},{"id":"b","title":"T","content":""},{"id":"c","title":"T","content":"C"},{"title":"no-id","content":"C"}]',
		);
		expect(out).toEqual([{ id: "c", title: "T", content: "C" }]);
	});

	it("returns [] for malformed output", () => {
		expect(parseTranslationBatch("not json")).toEqual([]);
		expect(parseTranslationBatch('{"object":"not array"}')).toEqual([]);
		expect(parseTranslationBatch("[{broken]")).toEqual([]);
	});

	it("recovers a truncated JSON array — closing bracket missing (v1.8.0)", () => {
		// Real-world failure: on long translations (title + full body + insight)
		// the model occasionally closes the outer array with `}` instead of `]`,
		// i.e. the final bracket is missing. That output used to be discarded
		// ("model returned no entry") so the story's re-translation silently
		// never happened. The parser now closes the still-open brackets.
		const truncated =
			'[{"id":"art-1","title":"T1","content":"C1","insight":{"summary":"S","significance":"G","impact":"I","recommendedAction":"R"}}';
		const out = parseTranslationBatch(truncated);
		expect(out).toEqual([
			{
				id: "art-1",
				title: "T1",
				content: "C1",
				insight: {
					summary: "S",
					significance: "G",
					impact: "I",
					recommendedAction: "R",
				},
			},
		]);
	});

	it("recovers a doubly-truncated array — object AND array closing missing", () => {
		// The insight's own closing `}` and the array's `]` both missing.
		const truncated =
			'[{"id":"art-1","title":"T1","content":"C1","insight":{"summary":"S","significance":"G","impact":"I","recommendedAction":"R"';
		expect(parseTranslationBatch(truncated)).toEqual([
			{
				id: "art-1",
				title: "T1",
				content: "C1",
				insight: {
					summary: "S",
					significance: "G",
					impact: "I",
					recommendedAction: "R",
				},
			},
		]);
	});

	it("recovers the array's closing bracket written as `}` (v1.8.0)", () => {
		// Real-world failure seen from Gemini on long translations: the outer
		// array's final `]` comes back as a stray `}` — `...\"}}}` instead of
		// `...\"}}]`. Appending brackets can't fix that (the stray brace is
		// still there), so the parser swaps the final `}` for `]`.
		const broken =
			'[{"id":"art-1","title":"T1","content":"C1","insight":{"summary":"S","significance":"G","impact":"I","recommendedAction":"R"}}';
		expect(parseTranslationBatch(broken)).toEqual([
			{
				id: "art-1",
				title: "T1",
				content: "C1",
				insight: {
					summary: "S",
					significance: "G",
					impact: "I",
					recommendedAction: "R",
				},
			},
		]);
	});
});
