/**
 * Shared types for the in-app Documentation & Tutorial content.
 *
 * Sections are built from rich `blocks` — paragraphs, icon-labeled feature
 * rows, bullet lists, and visual flow diagrams — so the docs page reads with
 * the app's design language (icons + typography), not plain walls of text.
 */

/** A visual flow step — rendered as an icon chip with arrows between steps. */
export interface FlowStep {
	icon: string;
	label: string;
	description?: string;
}

export type DocsBlock =
	| { type: "paragraph"; text: string; id?: string }
	| { type: "bullets"; items: string[]; id?: string }
	| {
			type: "features";
			items: { icon: string; label: string; text?: string }[];
			/** Anchor for this block (e.g. `sources-method-rss` deep links). */
			id?: string;
	  }
	| { type: "flow"; title?: string; steps: FlowStep[]; id?: string };

export interface DocsSection {
	/** Stable slug — the `#<id>` fragment on /docs. */
	id: string;
	title: string;
	summary: string;
	/** Material Symbols icon shown next to the section heading. */
	icon: string;
	/** Link back to the page this section documents (bidirectional). */
	pageRoute?: string;
	blocks: DocsBlock[];
}
