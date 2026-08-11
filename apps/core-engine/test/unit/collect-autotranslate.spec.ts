import { createTestDb, type TestDb } from "../helpers/db.js";
import { JobsService } from "../../src/modules/jobs/jobs.service.js";
import { JobsController } from "../../src/modules/jobs/jobs.controller.js";
import { registerJobRunner } from "../../src/modules/jobs/jobs.runners.js";
import type { CrawlerService } from "../../src/modules/crawler/crawler.service.js";
import type { IntelligenceService } from "../../src/modules/intelligence/intelligence.service.js";
import type { SearchService } from "../../src/modules/search/search.service.js";

/**
 * Auto-translate after collect (v1.9.0).
 *
 * When a collect run pulls in new stories AND an LLM is configured, the
 * collect job chains a `translate` job so the freshly collected stories are
 * translated automatically. In News mode (no API key) nothing is chained —
 * the LLM is an enhancement, never a hard dependency (R-A03).
 */

/** Fake translate runner — counts how many times it started. */
registerJobRunner("translate", () => ({
	label: "Fake translate",
	run: async () => ({ translated: 0 }),
}));

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(
	pred: () => boolean,
	timeoutMs = 4000,
	stepMs = 20,
): Promise<void> {
	const t0 = Date.now();
	while (!pred()) {
		if (Date.now() - t0 > timeoutMs) throw new Error("waitFor timed out");
		await sleep(stepMs);
	}
}

/** Stub CrawlerService — collectAll returns a fixed result. */
function crawlerStub(results: { sourceId: string; collected: number }[]) {
	return {
		enabledCount: jest.fn(async () => results.length),
		collectAll: jest.fn(async () => results),
	} as unknown as CrawlerService;
}

function controller(
	tdb: TestDb,
	crawler: CrawlerService,
	canTranslate: boolean,
) {
	const jobs = new JobsService(tdb.service);
	const intelligence = {
		canTranslate: jest.fn(async () => canTranslate),
		// v1.8.1 — the collect runner asks canAutoAnalyze first (Intelligence
		// mode gates auto-analysis); default false here so the old translate
		// chain is exercised unless a test flips it.
		canAutoAnalyze: jest.fn(async () => false),
		translateAllStories: jest.fn(async () => 0),
	} as unknown as IntelligenceService;
	const search = {} as unknown as SearchService;
	const ctl = new JobsController(jobs, crawler, intelligence, search);
	return { jobs, ctl, intelligence };
}

describe("auto-translate after collect", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
	});

	afterEach(() => {
		tdb.close();
	});

	it("chains a translate job when new stories were collected and an LLM is configured", async () => {
		const { jobs } = controller(
			tdb,
			crawlerStub([{ sourceId: "s1", collected: 4 }]),
			true,
		);
		// The controller registered the real "collect" runner in its constructor.
		const collect = jobs.start({ kind: "collect" });
		await waitFor(() => jobs.get(collect.id)?.status === "done");

		// The chain: a translate job must exist and be done.
		const translates = [...jobs.list().active, ...jobs.list().recent].filter(
			(j) => j.kind === "translate",
		);
		expect(translates).toHaveLength(1);
		await waitFor(() => jobs.get(translates[0].id)?.status === "done");
		expect(jobs.get(translates[0].id)?.status).toBe("done");
	});

	it("does not chain a translate job in News mode (no LLM configured)", async () => {
		const { jobs } = controller(
			tdb,
			crawlerStub([{ sourceId: "s1", collected: 4 }]),
			false,
		);
		const collect = jobs.start({ kind: "collect" });
		await waitFor(() => jobs.get(collect.id)?.status === "done");

		const translates = [...jobs.list().active, ...jobs.list().recent].filter(
			(j) => j.kind === "translate",
		);
		expect(translates).toHaveLength(0);
	});

	it("chains an analyze-missing job (then translation) in Intelligence mode (v1.8.1)", async () => {
		const jobs = new JobsService(tdb.service);
		const intelligence = {
			canTranslate: jest.fn(async () => true),
			canAutoAnalyze: jest.fn(async () => true),
			translateAllStories: jest.fn(async () => 0),
			missingInsightCount: jest.fn(() => 1),
			backfillMissingInsights: jest.fn(async () => 1),
		} as unknown as IntelligenceService;
		// The controller registers the "collect" + "analyze-missing" runners in
		// its constructor.
		new JobsController(
			jobs,
			crawlerStub([{ sourceId: "s1", collected: 4 }]),
			intelligence,
			{} as unknown as SearchService,
		);
		const collect = jobs.start({ kind: "collect" });
		await waitFor(() => jobs.get(collect.id)?.status === "done");

		// The collect chained analyze-missing; when it finishes it chains the
		// translate job, so both appear.
		await waitFor(() =>
			[...jobs.list().active, ...jobs.list().recent].some(
				(j) => j.kind === "analyze-missing",
			),
		);
		await waitFor(() =>
			[...jobs.list().active, ...jobs.list().recent].some(
				(j) => j.kind === "translate",
			),
		);
	});

	it("does not chain a translate job when collect found nothing new", async () => {
		const { jobs } = controller(
			tdb,
			crawlerStub([{ sourceId: "s1", collected: 0 }]),
			true,
		);
		const collect = jobs.start({ kind: "collect" });
		await waitFor(() => jobs.get(collect.id)?.status === "done");

		const translates = [...jobs.list().active, ...jobs.list().recent].filter(
			(j) => j.kind === "translate",
		);
		expect(translates).toHaveLength(0);
	});
});
