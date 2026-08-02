import { beforeEach, describe, expect, it } from "vitest";
import { useArchiveUiStore } from "./archive-ui-store.js";

/**
 * Collections UI store (v1.7.0) — module-scope state that must survive the
 * page unmounting when an item's detail page opens (so Back restores the same
 * folder location + selected card).
 */
describe("archive-ui-store", () => {
	beforeEach(() => {
		// Fresh state per test.
		useArchiveUiStore.setState({
			currentCollectionId: null,
			selectedCollectionId: null,
		});
	});

	it("sets and clears the current (breadcrumb) location", () => {
		const { setCurrent } = useArchiveUiStore.getState();
		setCurrent("cat-1");
		expect(useArchiveUiStore.getState().currentCollectionId).toBe("cat-1");
		setCurrent(null);
		expect(useArchiveUiStore.getState().currentCollectionId).toBeNull();
	});

	it("sets and clears the selected card", () => {
		const { setSelected } = useArchiveUiStore.getState();
		setSelected("folder-2");
		expect(useArchiveUiStore.getState().selectedCollectionId).toBe("folder-2");
		setSelected(null);
		expect(useArchiveUiStore.getState().selectedCollectionId).toBeNull();
	});

	it("keeps the location when only the selection changes", () => {
		const { setCurrent, setSelected } = useArchiveUiStore.getState();
		setCurrent("cat-1");
		setSelected("folder-2");
		const s = useArchiveUiStore.getState();
		expect(s.currentCollectionId).toBe("cat-1");
		expect(s.selectedCollectionId).toBe("folder-2");
	});
});
