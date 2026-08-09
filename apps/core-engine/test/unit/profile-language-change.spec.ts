import { createTestDb, type TestDb } from "../helpers/db.js";
import { ProfileService } from "../../src/modules/profile/profile.service.js";
import type { HistoryService } from "../../src/modules/history/history.service.js";
import type { LlmService } from "../../src/modules/llm/llm.service.js";
import type { JobsService } from "../../src/modules/jobs/jobs.service.js";

/**
 * Language-change → batch translate (v1.8.0) — `ProfileService.update` must
 * kick off the `translate` job whenever the AI output language actually
 * changes, so the EXISTING untranslated backlog follows the new language (not
 * just stories collected afterwards). Saving the same language again, or
 * patching unrelated fields, must NOT fire a job.
 */

function makeService(tdb: TestDb) {
	const jobs = {
		start: jest.fn(),
	} as unknown as JobsService;
	const history = {} as unknown as HistoryService;
	const llm = {} as unknown as LlmService;
	const svc = new ProfileService(tdb.service, history, llm, jobs);
	return {
		svc,
		jobs: jobs as unknown as { start: jest.Mock },
	};
}

describe("ProfileService.update — AI output language change", () => {
	let tdb: TestDb;

	beforeEach(() => {
		tdb = createTestDb();
	});

	afterEach(() => {
		tdb.close();
	});

	it("starts the translate job when the intelligence language changes", async () => {
		const { svc, jobs } = makeService(tdb);
		const updated = await svc.update({
			preferredIntelligenceLanguage: "fa",
		});
		expect(updated.preferredIntelligenceLanguage).toBe("fa");
		expect(jobs.start).toHaveBeenCalledTimes(1);
		expect(jobs.start).toHaveBeenCalledWith({ kind: "translate", input: {} });
	});

	it("does not start a translate job when the language is unchanged", async () => {
		const { svc, jobs } = makeService(tdb);
		await svc.update({ preferredIntelligenceLanguage: "en" });
		// Baseline default is "en" — same value, no job.
		expect(jobs.start).not.toHaveBeenCalled();
	});

	it("fires once per distinct language change, not on unrelated patches", async () => {
		const { svc, jobs } = makeService(tdb);
		await svc.update({ preferredIntelligenceLanguage: "fa" });
		// A second save with the SAME language (e.g. the settings form saving
		// the UI language again) must not re-fire the job.
		await svc.update({
			preferredIntelligenceLanguage: "fa",
			preferredUiLanguage: "en",
		});
		expect(jobs.start).toHaveBeenCalledTimes(1);

		// An unrelated profile patch (display name) never fires the job.
		await svc.update({ firstName: "Omid" });
		expect(jobs.start).toHaveBeenCalledTimes(1);

		// A real change to a second language fires again.
		await svc.update({ preferredIntelligenceLanguage: "de" });
		expect(jobs.start).toHaveBeenCalledTimes(2);
	});
	it("persists education + experience fields (v1.9.0)", async () => {
		const { svc } = makeService(tdb);
		const updated = await svc.update({
			fieldOfStudy: "Computer Science",
			degreeLevel: "bachelor",
			experienceLevel: "advanced",
		});
		expect(updated.fieldOfStudy).toBe("Computer Science");
		expect(updated.degreeLevel).toBe("bachelor");
		expect(updated.experienceLevel).toBe("advanced");

		// Clearing works too.
		const cleared = await svc.update({
			fieldOfStudy: null,
			degreeLevel: null,
			experienceLevel: null,
		});
		expect(cleared.fieldOfStudy).toBeNull();
		expect(cleared.degreeLevel).toBeNull();
		expect(cleared.experienceLevel).toBeNull();
	});
});
