/**
 * Story-reader footer actions (v1.8.0).
 *
 * The floating footer shows the actions in the reader bar; everything else
 * sits behind the "More ⋮" menu. v1.8.1 — the bar layout is fully
 * customizable on the Profile page (drag to reorder): `ui.readerActions` is
 * the full order, `ui.readerActionsInMore` the ids behind the More menu.
 * Older databases keep `ui.readerPinnedActions` (pinned ids only), which
 * `readerActionLayout` still honors as a fallback.
 */

export type ReaderActionId =
	| "markRead"
	| "save"
	| "recollect"
	| "retranslate"
	| "share"
	| "export"
	| "openOriginal"
	| "back";

/** Canonical display order for the footer actions. */
export const READER_ACTION_ORDER: ReaderActionId[] = [
	"markRead",
	"save",
	"recollect",
	"retranslate",
	"share",
	"export",
	"openOriginal",
	"back",
];

/** The default pinned set: the actions most people reach for every story. */
export const DEFAULT_PINNED_ACTIONS: ReaderActionId[] = [
	"markRead",
	"save",
	"share",
	"back",
];

/** v1.8.1 — the actions behind "More ⋮" by default (everything unpinned). */
export const DEFAULT_IN_MORE_ACTIONS: ReaderActionId[] =
	READER_ACTION_ORDER.filter((id) => !DEFAULT_PINNED_ACTIONS.includes(id));

export interface ReaderAction {
	id: ReaderActionId;
	icon: string;
	label: string;
	onClick: () => void;
	/** When true the label is shown dimmed as an in-progress state (e.g.
	 *  "Re-collecting…") and the click handler is expected to guard re-entry. */
	busy?: boolean;
}

/**
 * v1.8.1 — resolve the reader footer layout from app settings. `order` is the
 * full action order (Profile drag-reorder); `inMore` the ids behind More.
 * Falls back to the legacy `ui.readerPinnedActions` when the new keys are
 * absent, then to the built-in defaults.
 */
export function readerActionLayout(
	settings:
		| {
				"ui.readerActions"?: string[];
				"ui.readerActionsInMore"?: string[];
				"ui.readerPinnedActions"?: string[];
		  }
		| undefined,
): { order: string[]; inMore: Set<string> } {
	const order = Array.isArray(settings?.["ui.readerActions"])
		? settings["ui.readerActions"]
		: READER_ACTION_ORDER;
	let inMore: Set<string>;
	if (Array.isArray(settings?.["ui.readerActionsInMore"])) {
		inMore = new Set(settings["ui.readerActionsInMore"]);
	} else if (Array.isArray(settings?.["ui.readerPinnedActions"])) {
		// Legacy: pinned ids → everything else was behind More.
		const pinned = new Set(settings["ui.readerPinnedActions"]);
		inMore = new Set(READER_ACTION_ORDER.filter((id) => !pinned.has(id)));
	} else {
		inMore = new Set(DEFAULT_IN_MORE_ACTIONS);
	}
	return { order, inMore };
}

/** Stable icon per action id — used by the Profile customization list too. */
export function readerActionIcon(id: ReaderActionId): string {
	switch (id) {
		case "markRead":
			return "check_circle";
		case "save":
			return "bookmark";
		case "recollect":
			return "refresh";
		case "retranslate":
			return "translate";
		case "share":
			return "ios_share";
		case "export":
			return "file_download";
		case "openOriginal":
			return "open_in_new";
		case "back":
			return "arrow_back";
	}
}

/** User-facing label per action id (i18n) — Profile customization + menus. */
export function readerActionLabel(
	t: (key: string) => string,
	id: ReaderActionId,
): string {
	switch (id) {
		case "markRead":
			return t("article.markRead");
		case "save":
			return t("article.save");
		case "recollect":
			return t("article.recollect");
		case "retranslate":
			return t("article.retranslate");
		case "share":
			return t("article.share");
		case "export":
			return t("article.export");
		case "openOriginal":
			return t("article.original");
		case "back":
			return t("article.back");
	}
}

/**
 * Split the available actions into the primary bar and the More menu,
 * preserving the layout's order. See `readerActionLayout`.
 */
export function splitReaderActions(
	actions: ReaderAction[],
	layout: { order: string[]; inMore: Set<string> },
): { pinned: ReaderAction[]; more: ReaderAction[] } {
	const ordered = [...actions].sort((a, b) => {
		const ia = layout.order.indexOf(a.id);
		const ib = layout.order.indexOf(b.id);
		return (
			(ia === -1 ? layout.order.length : ia) -
			(ib === -1 ? layout.order.length : ib)
		);
	});
	return {
		pinned: ordered.filter((a) => !layout.inMore.has(a.id)),
		more: ordered.filter((a) => layout.inMore.has(a.id)),
	};
}
