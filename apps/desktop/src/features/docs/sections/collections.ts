import type { DocsSection } from "../types.js";

/** Collections — the icon-view page for organizing archive items. */
export const collectionsSection: DocsSection = {
	id: "collections",
	title: "Collections",
	summary: "Organize your archive like a file explorer.",
	icon: "folder_special",
	pageRoute: "/archive/collections",
	blocks: [
		{
			type: "paragraph",
			text: 'Collections is the file-explorer view of your archive. Categories are semantic roots (e.g. "Security" or "AI"), folders nest under them (max depth 3), and items live at the leaves. Reach it from the Archive section tabs (Items · Collections · Bookmarks · Search · Media · Trash) shown on every Archive page.',
		},
		{
			type: "paragraph",
			text: "Why it works this way: an item should be findable without remembering where you filed it. The icon view mirrors a file explorer because that's a mental model everyone already knows — categories for the big ideas, folders for your own grouping, and one place to look when you're inside a folder. Items you didn't file anywhere simply stay at the top level.",
		},
		{
			type: "flow",
			title: "Organize an item",
			steps: [
				{ icon: "create_new_folder", label: "Create folders" },
				{ icon: "add", label: "Add items" },
				{ icon: "folder_open", label: "Browse" },
				{ icon: "link_off", label: "Remove" },
			],
		},
		{
			type: "features",
			items: [
				{
					icon: "folder",
					label: "Folder cards",
					text: "The current folder's children render as big folder cards (filled for categories, plain for folders), each showing what's inside at a glance — its sub-folder and item counts (e.g. \"2 folders · 5 items\"). Single-click (or focus) selects a card and shows that folder's own items below; double-click (or Enter) goes inside — the breadcrumb and the grid move in. A dashed + tile at the end of the grid creates a new category (at the top level) or a new folder (inside the current folder).",
				},
				{
					icon: "more_vert",
					label: "⋯ menu",
					text: "Every card carries a three-dot menu (revealed on hover or selection) with its actions: Add items, New folder, Rename, and Delete. Rename turns the card name into an inline input; Delete asks for confirmation first.",
				},
				{
					icon: "account_tree",
					label: "Breadcrumb",
					text: 'A breadcrumb above the grid shows the path to the folder you\'re viewing — click any segment to jump to it, or "Collections" to return to the top level.',
				},
				{
					icon: "add",
					label: "Add items",
					text: 'An "Add items" button sits next to the item list (and in every folder\'s ⋯ menu): it searches your archive and moves the results into that folder — an item lives in one collection at a time.',
				},
				{
					icon: "edit_note",
					label: "Open an item",
					text: "Click any item in the list to open its detail page (article reader, briefing, or cached search result). Back returns you to the same folder, still selected.",
				},
				{
					icon: "link_off",
					label: "Remove from collection",
					text: "Every item row has a remove action, confirmed first. The item stays in your archive — it just moves back to uncategorized.",
				},
			],
		},
		{
			type: "bullets",
			items: [
				"Each folder lists only its own items — an item inside a sub-folder appears when you go into that sub-folder, never under its parent. The card's count label shows everything in the subtree at a glance.",
				"Deleting a collection moves it to the Trash — its items keep their hidden folder link and come back if you restore it, or move to uncategorized if you delete it forever. Nothing is ever deleted without you deciding.",
				"A folder and a category with the same name can sit side by side; two folders (or two categories) with the same name in the same place are refused.",
				"Click a folder to see its items; double-click (or Enter) to go inside — the 'How it works' button in the header opens this documentation section, where the full gesture guide lives.",
				"The Archive page stays focused on browsing and searching items — organize them here.",
			],
		},
	],
};
