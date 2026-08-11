import { describe, expect, it } from "vitest";
import {
	DEFAULT_PINNED_ACTIONS,
	READER_ACTION_ORDER,
	readerActionLayout,
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

describe("readerActionLayout (v1.8.1)", () => {
	it("defaults to the canonical order + default in-More set when nothing is stored", () => {
		const layout = readerActionLayout(undefined);
		expect([...layout.order]).toEqual(READER_ACTION_ORDER);
		expect([...layout.inMore]).toEqual([
			"recollect",
			"retranslate",
			"export",
			"openOriginal",
		]);
	});

	it("honors the legacy pinned-only preference", () => {
		const layout = readerActionLayout({
			"ui.readerPinnedActions": ["export", "back"],
		});
		expect([...layout.inMore]).toEqual([
			"markRead",
			"save",
			"recollect",
			"retranslate",
			"share",
			"openOriginal",
		]);
	});

	it("prefers the new order + in-More settings over the legacy preference", () => {
		const layout = readerActionLayout({
			"ui.readerActions": [
				"back",
				"save",
				"markRead",
				"share",
				"recollect",
				"retranslate",
				"export",
				"openOriginal",
			],
			"ui.readerActionsInMore": ["recollect"],
			// Legacy is ignored once the new keys exist.
			"ui.readerPinnedActions": ["markRead"],
		});
		expect(layout.order[0]).toBe("back");
		expect([...layout.inMore]).toEqual(["recollect"]);
	});
});

describe("splitReaderActions (v1.8.1)", () => {
	it("splits by the layout, preserving its order", () => {
		const layout = readerActionLayout(undefined);
		const { pinned, more } = splitReaderActions(makeActions(), layout);
		expect(pinned.map((a) => a.id)).toEqual(DEFAULT_PINNED_ACTIONS);
		expect(more.map((a) => a.id)).toEqual([
			"recollect",
			"retranslate",
			"export",
			"openOriginal",
		]);
	});

	it("orders the bar actions by the saved order", () => {
		const layout = readerActionLayout({
			"ui.readerActions": [
				"back",
				"save",
				"markRead",
				"recollect",
				"retranslate",
				"share",
				"export",
				"openOriginal",
			],
			"ui.readerActionsInMore": [],
		});
		const { pinned } = splitReaderActions(makeActions(), layout);
		expect(pinned.map((a) => a.id)).toEqual([
			"back",
			"save",
			"markRead",
			"recollect",
			"retranslate",
			"share",
			"export",
			"openOriginal",
		]);
	});

	it("moves everything behind More when the in-More set covers all", () => {
		const layout = readerActionLayout({
			"ui.readerActions": [...READER_ACTION_ORDER],
			"ui.readerActionsInMore": [...READER_ACTION_ORDER],
		});
		const { pinned, more } = splitReaderActions(makeActions(), layout);
		expect(pinned).toHaveLength(0);
		expect(more).toHaveLength(8);
	});

	it("splits only the actions that are actually available", () => {
		// e.g. no story-exporter plugins → the export action doesn't exist.
		const available = makeActions().filter((a) => a.id !== "export");
		const { pinned, more } = splitReaderActions(
			available,
			readerActionLayout(undefined),
		);
		expect(pinned.map((a) => a.id)).toEqual(DEFAULT_PINNED_ACTIONS);
		expect(more.map((a) => a.id)).toEqual([
			"recollect",
			"retranslate",
			"openOriginal",
		]);
	});
});
