/**
 * In-app Documentation & Tutorial — section aggregator.
 *
 * One file per page/feature lives in `sections/` (see `/docs-update` skill for
 * the contract): every page links to its section via `/docs#<id>`, and each
 * section links back via `pageRoute`. This module only imports and exports
 * them; keep the per-section content in its own file so diffs stay small.
 */

import { archiveSection } from "./sections/archive.js";
import { bookmarksSection } from "./sections/bookmarks.js";
import { briefSection } from "./sections/brief.js";
import { docsSection } from "./sections/docs.js";
import { historySection } from "./sections/history.js";
import { mediaSection } from "./sections/media.js";
import { searchSection } from "./sections/search.js";
import { sourcesSection } from "./sections/sources.js";
import { transparencySections } from "./sections/transparency.js";

export const DOCS_SECTIONS = [
	briefSection,
	sourcesSection,
	archiveSection,
	bookmarksSection,
	searchSection,
	historySection,
	mediaSection,
	docsSection,
];

export const TRANSPARENCY_SECTIONS = transparencySections;

export type { DocsBlock, DocsSection, FlowStep } from "./types.js";
