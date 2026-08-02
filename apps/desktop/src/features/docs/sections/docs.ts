import type { DocsSection } from "../types.js";

/** Documentation & Tutorial — this page itself. */
export const docsSection: DocsSection = {
	id: "docs",
	title: "Documentation & Tutorial",
	summary: "This page — how Vorynth works, explained in plain terms.",
	icon: "menu_book",
	pageRoute: "/docs",
	blocks: [
		{
			type: "paragraph",
			text: "Every screen links back here, and every section links to the page it explains. If something is unclear, this is the place to look first.",
		},
	],
};
