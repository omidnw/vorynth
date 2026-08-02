import { createTestDb, type TestDb } from "../helpers/db.js";
import { JobsService } from "../../src/modules/jobs/jobs.service.js";
import { registerJobRunner } from "../../src/modules/jobs/jobs.runners.js";

/**
 * Background job persistence + queueing (v1.7.0).
 *
 * Jobs were memory-only: a restart wiped them and same-kind clicks silently
 * deduped into no new job. Now every job is persisted to the `jobs` table, a
 * same-kind start is queued and auto-promoted, and a restart restores
 * interrupted jobs as `queued` and resumes them from their last checkpoint.
 * These tests run against a throwaway temp DB (`createTestDb`).
 */

/** Fake runner: 5 items, one `update` per item, resumable via `resumeFrom`. */
registerJobRunner("collect", () => ({
	label: "Fake collect",
	run: async ({ update, resumeFrom, throwIfCanceled }) => {
		for (let i = resumeFrom; i < 5; i++) {
			throwIfCanceled();
			update({
				message: `item ${i + 1}/5`,
				itemsDone: i + 1,
				itemsTotal: 5,
				fraction: (i + 1) / 5,
			});
			await sleep(15);
		}
		return { done: true, processed: 5 - resumeFrom };
	},
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

describe("JobsService", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
	});

	afterEach(() => {
		tdb.close();
	});

	it("queues a same-kind job and promotes it when the running one finishes", async () => {
		const jobs = new JobsService(tdb.service);

		const first = jobs.start({ kind: "collect", input: null });
		expect(first.status).toBe("running");

		// A second same-kind start must create a visible queued job — never a
		// silent no-op.
		const second = jobs.start({ kind: "collect", input: null });
		expect(second.status).toBe("queued");

		await waitFor(() => {
			const a = jobs.get(first.id);
			const b = jobs.get(second.id);
			return a?.status === "done" && b?.status === "done";
		});

		expect(jobs.get(first.id)?.status).toBe("done");
		expect(jobs.get(second.id)?.status).toBe("done");
		// Both ran their 5 items, serially.
		expect(jobs.get(first.id)?.progress.itemsDone).toBe(5);
		expect(jobs.get(second.id)?.progress.itemsDone).toBe(5);
	});

	it("restores an interrupted job and resumes from its checkpoint", async () => {
		const jobs = new JobsService(tdb.service);
		const a = jobs.start({ kind: "collect", input: null });

		// Let the job get partway, then simulate a restart: a fresh service
		// over the same DB must restore the row and pick up where it left off.
		await waitFor(() => (jobs.get(a.id)?.progress.itemsDone ?? 0) >= 2);

		const jobs2 = new JobsService(tdb.service);
		await jobs2.onModuleInit();

		expect(jobs2.get(a.id)?.status).toBe("running"); // restored as queued, promoted
		await waitFor(() => jobs2.get(a.id)?.status === "done");

		const resumed = jobs2.get(a.id);
		expect(resumed?.status).toBe("done");
		expect(resumed?.progress.itemsDone).toBe(5);
		expect(resumed?.progress.itemsTotal).toBe(5);
		// The original startedAt survives the restart.
		expect(resumed?.startedAt).toBe(a.startedAt);

		// The original service's runner is still in flight over the same DB —
		// settle it before the harness closes the temp DB.
		await waitFor(() => jobs.get(a.id)?.status === "done");
	});

	it("keeps the persisted row across a restart (jobs table)", async () => {
		const jobs = new JobsService(tdb.service);
		const a = jobs.start({ kind: "collect", input: { force: true } });
		await waitFor(() => jobs.get(a.id)?.status === "done");

		const row = tdb.service.rawDb
			.prepare("SELECT kind, label, status, input_json FROM jobs WHERE id = ?")
			.get(a.id) as {
			kind: string;
			label: string;
			status: string;
			input_json: string;
		};
		expect(row.kind).toBe("collect");
		expect(row.label).toBe("Fake collect");
		expect(row.status).toBe("done");
		expect(JSON.parse(row.input_json)).toEqual({ force: true });
	});

	it("flips running jobs to queued on shutdown so they resume next boot", async () => {
		const jobs = new JobsService(tdb.service);
		const a = jobs.start({ kind: "collect", input: null });
		await waitFor(() => (jobs.get(a.id)?.progress.itemsDone ?? 0) >= 1);

		jobs.onModuleDestroy();

		expect(jobs.get(a.id)?.status).toBe("queued");
		const row = tdb.service.rawDb
			.prepare("SELECT status FROM jobs WHERE id = ?")
			.get(a.id) as { status: string };
		expect(row.status).toBe("queued");
	});

	it("a canceled job stays canceled even when its runner later resolves", async () => {
		const jobs = new JobsService(tdb.service);
		const a = jobs.start({ kind: "collect", input: null });

		jobs.cancel(a.id);
		expect(jobs.get(a.id)?.status).toBe("canceled");

		// The runner throws "job canceled" via throwIfCanceled — and even if it
		// resolved instead, the canceled guard must not flip it back to done.
		await sleep(200);
		expect(jobs.get(a.id)?.status).toBe("canceled");
	});
});
