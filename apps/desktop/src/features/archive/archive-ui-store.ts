import { create } from "zustand";

/**
 * Collections page UI state (v1.7.0) — the file-explorer location.
 *
 * Lives in a module-scope store (not component state) so it survives the page
 * unmounting when the user opens an item's detail page and navigates back —
 * the same folder stays open and the same card stays selected, which is what
 * "Back returns to the same folder" means.
 */
interface ArchiveUiState {
	/** The folder the explorer is "in" (breadcrumb location). Its direct
	 *  children render as the icon grid. null = root (top-level collections). */
	currentCollectionId: string | null;
	/** The highlighted folder card; its subtree items show in the items area
	 *  (single-click select = "show me this folder's items"). */
	selectedCollectionId: string | null;

	setCurrent: (id: string | null) => void;
	setSelected: (id: string | null) => void;
}

export const useArchiveUiStore = create<ArchiveUiState>((set) => ({
	currentCollectionId: null,
	selectedCollectionId: null,

	setCurrent: (id) => set({ currentCollectionId: id }),
	setSelected: (id) => set({ selectedCollectionId: id }),
}));
