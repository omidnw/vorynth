import type { DocsSection } from "../types.js";

/** Archive — the unified user-owned intelligence space. */
export const archiveSection: DocsSection = {
	id: "archive",
	title: "Archive",
	summary: "Everything Vorynth has collected, organized your way.",
	icon: "inventory_2",
	pageRoute: "/archive",
	blocks: [
		{
			type: "paragraph",
			text: "The Archive is one space for every item Vorynth has produced: collected stories, saved (bookmarked) items, generated summaries, keyword searches, and Ask-AI answers. It's your personal intelligence space — everything you can search, tag, note, and organize.",
		},
		{
			type: "flow",
			title: "The lifecycle of an item",
			steps: [
				{ icon: "cloud_download", label: "Collect" },
				{ icon: "bookmark", label: "Save" },
				{ icon: "create_new_folder", label: "Organize" },
				{ icon: "search", label: "Find" },
			],
		},
		{
			type: "features",
			items: [
				{ icon: "search", label: "Search card", text: "Links to the full search page — keyword and Ask AI across every article." },
				{ icon: "folder_special", label: "Collections explorer", text: "A file-explorer tree: categories (semantic roots) and folders nested under them (max depth 3). Rename by double-click or the pencil, add items by searching, delete — items move to 'uncategorized', never deleted." },
				{ icon: "filter_list", label: "Items list", text: "Type filters (All / Stories / Saved / Summaries / Searches / AI asks), a text filter by title or note, and a 'Show archived' toggle. Paginated — 'Show more' loads the next batch." },
				{ icon: "edit_note", label: "Notes & tags", text: "Every item can carry a free-form note and tags; both are searchable from the filter box." },
			],
		},
			{
				type: "bullets",
				items: [
					"A story opens the article reader; a summary opens the briefing detail; a search or AI ask opens the full cached result.",
					"Bookmarks get their own page and also appear under 'Saved' in the Archive.",
					"Save, Note, and Archive actions live on each item row.",
					"Naming: a folder and a category with the same name can sit side by side (they're different types). Two folders — or two categories — with the same name in the same place are refused.",
				],
			},
	],
};
