import type { DocsSection } from "../types.js";

/** Bookmarks — saved references, never silently deleted. */
export const bookmarksSection: DocsSection = {
	id: "bookmarks",
	title: "Bookmarks",
	summary: "Your saved references — never silently deleted.",
	icon: "bookmark",
	pageRoute: "/bookmarks",
	blocks: [
		{
			type: "paragraph",
			text: "Bookmarking an item marks it as yours. Saved items appear both in the Archive (under 'Saved') and on this page.",
		},
		{
			type: "bullets",
			items: [
				"A bookmark is a promise: retention pruning skips bookmarked articles, and deleting a source with saved stories requires explicit confirmation.",
				"Removing a bookmark only removes the flag — the story stays, and you can bookmark it again any time.",
				"Each row shows the item type, author, date, and tags; the bookmark icon removes it with a light confirmation.",
			],
		},
	],
};
