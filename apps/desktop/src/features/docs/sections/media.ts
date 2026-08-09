import type { DocsSection } from "../types.js";

/** Media — article images/video, kept locally only when you choose. */
export const mediaSection: DocsSection = {
	id: "media",
	title: "Media & the reader",
	summary:
		"Article images and video — kept locally only when you choose, and downloadable with copyright credit.",
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
		{
			type: "paragraph",
			text: "Since v1.8.0 every kept item shows a real preview — the image as a clickable thumbnail, the video as an inline player — and can be downloaded. Images download either with a copyright attribution bar drawn into them — naming the blog, the article title, and the source URL — or as the original file. Videos always download as the original, because credit can only be drawn into images. Previews stream straight from the local copy on this device, so they work fully offline.",
		},
		{
			type: "features",
			items: [
				{
					icon: "image",
					label: "Preview",
					text: "Each kept image shows a thumbnail of the actual file; click it to view it full size. Videos play inline with native controls — all from the local copy, offline.",
				},
				{
					icon: "download",
					label: "Download",
					text: "Each kept item has a Download button that opens a small menu with the two choices below.",
				},
				{
					icon: "copyright",
					label: "Download with attribution",
					text: "Draws a credit bar into the image: © year, blog, article title, and source URL.",
				},
				{
					icon: "file_download",
					label: "Download original",
					text: "Saves the file exactly as it was stored, with no credit added.",
				},
				{
					icon: "privacy_tip",
					label: "Policy warning",
					text: "Before the first download you confirm the blog's privacy policy may restrict it. 'Don't show again' turns the warning off; re-enable it in Settings → Media.",
				},
				{
					icon: "tune",
					label: "Copyright & Attribution plugin",
					text: "A core, always-on plugin whose setting picks the download default — attribution first or original first. The menu always offers both.",
				},
			],
		},
		{
			type: "flow",
			title: "Downloading a media item",
			steps: [
				{ icon: "photo_library", label: "Open Media" },
				{ icon: "download", label: "Pick a format" },
				{ icon: "privacy_tip", label: "Confirm policy (once)" },
				{ icon: "copyright", label: "Credit added / original" },
			],
		},
		{
			type: "paragraph",
			text: "Reader tools (v1.8.0) make a story readable, portable, and in your own language before you ever keep media.",
		},
		{
			type: "features",
			items: [
				{
					icon: "article",
					label: "Rich formatting",
					text: "When a feed provides an article's full HTML, the reader renders its formatting — bold, links, lists, quotes — instead of showing raw markup. Plain-text stories show as-is. Formatting is sanitized before it renders (no scripts, no styles, no remote images) and links always open in a new tab.",
				},
				{
					icon: "translate",
					label: "Translate a story",
					text: "Untranslated stories show a Translate button in front of the title. One tap translates the title and body on demand, reusing the same machinery as Translate Stories. If the stored translation is detected as incomplete (truncated or leftover placeholders), a Re-translate option appears instead.",
				},
				{
					icon: "refresh",
					label: "Re-collect a story",
					text: "A Re-collect button sits next to Save in the reader footer: it re-fetches this story's original article, refreshes its full text, re-translates anything that went stale, and fills a missing AI analysis. A story whose stored text looks damaged shows a note pointing you here.",
				},
				{
					icon: "translate",
					label: "Re-translate a story",
					text: "Right next to Re-collect, a translated story carries a Re-translate action: it forces a fresh LLM translation of the title and body — lighter than Re-collect (no re-fetch) — useful after changing your intelligence language or when the stored translation went stale.",
				},
				{
					icon: "more_vert",
					label: "Reader action bar",
					text: "The bottom bar keeps the actions you use most (Mark read, Save, Share, Back) and tucks the rest — Re-collect, Re-translate, Export, Open original — behind a 'More ⋮' menu. Which actions stay up front is your choice: Profile → Reader actions pins or unpins each one.",
				},
				{
					icon: "file_download",
					label: "Export — Story Renderer",
					text: "The reader footer's Export button opens a panel to download the story as Markdown, a themed HTML page, or a ready-to-share screenshot. The same Export button appears for AI insights, Ask-AI answers, saved history entries, and period briefings — any Vorynth content can be kept as a portable file.",
				},
			],
		},
	],
};
