import type { DocsSection } from "../types.js";

/** Media — article images/video, kept locally only when you choose. */
export const mediaSection: DocsSection = {
	id: "media",
	title: "Media",
	summary: "Article images and video — kept locally only when you choose.",
	icon: "photo_library",
	pageRoute: "/media",
	blocks: [
		{
			type: "paragraph",
			text: "Vorynth collects the article text, but images and video are fetched on demand from the original source — nothing is stored unless you opt in. In the article reader, each media item can be 'kept locally', which downloads the bytes to disk.",
		},
		{
			type: "paragraph",
			text: "Why on demand: text is light, media is heavy. Storing every image and video by default would silently balloon your disk for content you may never open. So media stays a deliberate choice — 'keep locally' when you actually want it to survive the original site changing or going away, nothing otherwise.",
		},
		{
			type: "flow",
			title: "How media works",
			steps: [
				{ icon: "menu_book", label: "Read article" },
				{ icon: "download", label: "Keep locally" },
				{ icon: "photo_library", label: "Media dashboard" },
			],
		},
		{
			type: "bullets",
			items: [
				"The reader shows the story's stored text. When Translate Stories ran, the translated body appears by default with an Original/Translated toggle above it — the original text is never overwritten.",
				"Media appears below the body: 'keep locally' downloads it, 'release' streams it again from the source.",
			],
		},
		{
			type: "paragraph",
			text: "The Media page is the dashboard for everything you chose to keep: every article with locally-kept media, its size on disk, and the controls to release a local copy back to streaming or purge everything at once. Purging asks for confirmation.",
		},
		{
			type: "features",
			items: [
				{
					icon: "today",
					label: "Relationship to the Brief",
					text: "Media belongs to articles, and articles appear in the Brief as collected stories — the media dashboard shows the ones you deliberately kept.",
				},
				{
					icon: "inventory_2",
					label: "Relationship to the Archive",
					text: "The same articles live in the Archive; keeping media local means it stays available even if the source site changes or goes away — but it's a per-item, deliberate choice, never automatic.",
				},
			],
		},
	],
};
