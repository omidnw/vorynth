/**
 * Story-reader footer actions (v1.8.0).
 *
 * The floating footer shows the actions the user pinned to the primary bar;
 * everything else sits behind the "More ⋮" menu. Pinning is a Profile
 * preference stored in `ui.readerPinnedActions` (app_settings, JSON array of
 * action ids). Missing/absent → the default pinned set; an explicit empty
 * array means "everything in More".
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

export interface ReaderAction {
	id: ReaderActionId;
	icon: string;
	label: string;
	onClick: () => void;
	/** When true the label is shown dimmed as an in-progress state (e.g.
	 *  "Re-collecting…") and the click handler is expected to guard re-entry. */
	busy?: boolean;
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
 * preserving canonical order. `pinnedSetting` is `ui.readerPinnedActions`
 * (undefined → default; [] → everything in More).
 */
export function splitReaderActions(
	actions: ReaderAction[],
	pinnedSetting: string[] | undefined,
): { pinned: ReaderAction[]; more: ReaderAction[] } {
	const pinned = Array.isArray(pinnedSetting)
		? new Set(pinnedSetting)
		: new Set(DEFAULT_PINNED_ACTIONS);
	const ordered = [...actions].sort(
		(a, b) =>
			READER_ACTION_ORDER.indexOf(a.id) - READER_ACTION_ORDER.indexOf(b.id),
	);
	return {
		pinned: ordered.filter((a) => pinned.has(a.id)),
		more: ordered.filter((a) => !pinned.has(a.id)),
	};
}
