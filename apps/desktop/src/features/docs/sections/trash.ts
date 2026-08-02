import type { DocsSection } from "../types.js";

/** Trash — soft-deleted collections & history, with restore and retention. */
export const trashSection: DocsSection = {
	id: "trash",
	title: "Trash",
	summary: "Deleted collections and history — restorable, never silently lost.",
	icon: "delete",
	pageRoute: "/archive/trash",
	blocks: [
		{
			type: "paragraph",
			text: "Deleting is scary until it isn't. In Vorynth, deleting a collection, folder, or history entry never destroys it immediately — it moves to the Trash. From there you can restore it exactly as it was, delete it forever, or let the retention window clear it automatically. The Trash is the safety net that turns 'delete' from a loss into a decision.",
		},
		{
			type: "flow",
			title: "A delete's journey",
			steps: [
				{ icon: "delete", label: "Delete (soft)" },
				{ icon: "delete_sweep", label: "Sits in Trash" },
				{ icon: "restore", label: "Restore — or" },
				{ icon: "delete_forever", label: "Delete forever" },
			],
		},
		{
			type: "features",
			items: [
				{
					icon: "restore",
					label: "Restore",
					text: "Brings a deleted collection (and its whole folder tree) back to its original place with one click. Items that still point into it return with it; items you moved to another folder keep their new home — restore never overwrites a choice you made.",
				},
				{
					icon: "delete_forever",
					label: "Delete forever",
					text: "Permanently removes one entry. For a collection, stories inside simply move to uncategorized — no article is ever deleted by cleaning up folders. For a history entry, the entry and its cached data are gone for good. Saved (bookmarked) items inside require an explicit confirmation, because a bookmark is your ownership of a reference.",
				},
				{
					icon: "delete_sweep",
					label: "Empty trash",
					text: "Clears every trashed entry at once. Confirms first — and warns you whenever saved items would be removed along with it.",
				},
				{
					icon: "timer",
					label: "Auto-delete window",
					text: "Settings → Trash lets you choose how long entries stay before they're purged automatically (default 7 days; days, weeks, months, or years). 0 keeps everything until you empty the trash yourself. Saved items are never auto-purged.",
				},
			],
		},
		{
			type: "bullets",
			items: [
				"Deleting a collection or history entry anywhere in the app is always a soft delete — the Trash page is where permanent decisions happen.",
				"Restoring a collection returns its folders and items exactly as they were: items that still point into the restored subtree come back with it, items you filed elsewhere stay where you put them.",
				"A soft-deleted collection no longer holds its name — you can create a new one with the same name while the old one is in the Trash. Restoring a name that a live sibling took is refused (rename or delete first).",
				"Items inside a trashed collection stay in your archive (they just keep their hidden folder link) — purging the folder moves them to uncategorized, nothing more.",
				"The daily sweep never deletes bookmarked history entries automatically (R-A10); only you can remove a saved item, with confirmation.",
			],
		},
	],
};
