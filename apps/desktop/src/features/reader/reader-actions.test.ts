import { describe, expect, it } from "vitest";
import {
	DEFAULT_PINNED_ACTIONS,
	splitReaderActions,
	type ReaderAction,
} from "./reader-actions.js";

function makeActions(): ReaderAction[] {
	return (
		[
			"markRead",
			"save",
			"recollect",
			"retranslate",
			"share",
			"export",
			"openOriginal",
			"back",
		] as const
	).map((id) => ({ id, icon: "x", label: id, onClick: () => {} }));
}

describe("splitReaderActions (v1.8.0)", () => {
	it("uses the default pinned set when no preference is stored", () => {
		const { pinned, more } = splitReaderActions(makeActions(), undefined);
		expect(pinned.map((a) => a.id)).toEqual(DEFAULT_PINNED_ACTIONS);
		expect(more.map((a) => a.id)).toEqual([
			"recollect",
			"retranslate",
			"export",
			"openOriginal",
		]);
	});

	it("honors a custom pinned preference", () => {
		const { pinned, more } = splitReaderActions(makeActions(), [
			"export",
			"back",
		]);
		expect(pinned.map((a) => a.id)).toEqual(["export", "back"]);
		expect(more.map((a) => a.id)).toEqual([
			"markRead",
			"save",
			"recollect",
			"retranslate",
			"share",
			"openOriginal",
		]);
	});

	it("treats an explicit empty array as 'everything in More'", () => {
		const { pinned, more } = splitReaderActions(makeActions(), []);
		expect(pinned).toHaveLength(0);
		expect(more).toHaveLength(8);
	});

	it("preserves canonical order and drops unknown ids", () => {
		const { pinned } = splitReaderActions(makeActions(), [
			"back",
			"save",
			"nope",
		]);
		expect(pinned.map((a) => a.id)).toEqual(["save", "back"]);
	});

	it("splits only the actions that are actually available", () => {
		// e.g. no story-exporter plugins → the export action doesn't exist.
		const available = makeActions().filter((a) => a.id !== "export");
		const { pinned, more } = splitReaderActions(available, undefined);
		expect(pinned.map((a) => a.id)).toEqual(DEFAULT_PINNED_ACTIONS);
		expect(more.map((a) => a.id)).toEqual([
			"recollect",
			"retranslate",
			"openOriginal",
		]);
	});
});
