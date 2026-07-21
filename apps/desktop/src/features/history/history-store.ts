import { create } from "zustand";

/**
 * History drawer UI state.
 *
 * The drawer's open/close survives route changes by living in a global store.
 * Data fetching happens in `<HistoryDrawer>` via react-query; this store only
 * owns the interaction state: whether the drawer is open, whether we're in
 * list or detail view, multi-select state, and the entry currently shown.
 */
export type HistoryScope = "search" | "brief" | "generated";

interface HistoryState {
	open: boolean;
	/** Which kind of history the drawer shows. Set from `useLocation()` on open. */
	scope: HistoryScope;
	/** Whether multi-select (bulk actions) mode is on. */
	selectMode: boolean;
	/** Set of selected entry ids (only meaningful when selectMode is true). */
	selectedIds: Set<string>;
	/** Bumped every time an entry is mutated so react-query refetches. */
	mutationNonce: number;

	openDrawer: (scope?: HistoryScope) => void;
	closeDrawer: () => void;
	setScope: (scope: HistoryScope) => void;
	toggleSelect: (id: string) => void;
	clearSelection: () => void;
	setSelectMode: (on: boolean) => void;
	/** Call after any patch/delete to invalidate lists. */
	noteMutation: () => void;
}

export const useHistoryStore = create<HistoryState>((set) => ({
	open: false,
	scope: "search",
	selectMode: false,
	selectedIds: new Set(),
	mutationNonce: 0,

	openDrawer: (scope) =>
		set((s) => ({
			open: true,
			scope: scope ?? s.scope,
			selectMode: false,
			selectedIds: new Set(),
		})),
	closeDrawer: () =>
		set({
			open: false,
			selectMode: false,
			selectedIds: new Set(),
		}),
	setScope: (scope) =>
		set({ scope, selectMode: false, selectedIds: new Set() }),

	toggleSelect: (id) =>
		set((s) => {
			const next = new Set(s.selectedIds);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return { selectedIds: next };
		}),
	clearSelection: () => set({ selectedIds: new Set() }),
	setSelectMode: (on) => set({ selectMode: on, selectedIds: new Set() }),
	noteMutation: () => set((s) => ({ mutationNonce: s.mutationNonce + 1 })),
}));
