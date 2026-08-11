import { useEffect, useState } from "react";

/**
 * Category navigation + search state shared by the Settings and Profile pages.
 *
 * Owns:
 *  - the search query, and per-category match flags (a category matches when
 *    its lowercase `search` terms contain the lowercased query),
 *  - the active category, which follows the rail/chips selection and tracks
 *    the in-view category while scrolling (via IntersectionObserver),
 *  - derived `dimmedIds` (categories with zero visible sections) and a
 *    `noResults` flag for the empty-query-result state.
 */
export interface CategorySearchInput {
	id: string;
	search: string;
	/**
	 * v1.8.1 — per-card keyword blobs. A query that matches an ITEM rings that
	 * card instead of the whole category (e.g. "appearance" only rings the
	 * Appearance card, and "translate" also suggests the Language card). The
	 * category stays visible whenever the category blob OR any item matches.
	 */
	items?: { id: string; search: string }[];
}

export interface CategorySearchState {
	query: string;
	setQuery: (value: string) => void;
	activeId: string;
	/** Set the active category and scroll its section into view. */
	select: (id: string) => void;
	/**
	 * Scroll the FIRST matching category into view. Called on Enter / the
	 * search button — typing only dims + rings matches; it never yanks the
	 * page around (v1.8.0 feedback).
	 */
	focusFirstMatch: () => void;
	/** Category ids with no visible sections under the current query. */
	dimmedIds: string[];
	/** True when the query is non-empty and no category matches. */
	noResults: boolean;
	/** Whether a category matches the query (empty query matches everything). */
	matches: (id: string) => boolean;
	/**
	 * Category ids matching the current query — the sections to highlight with
	 * a ring while searching. Empty when the query is empty. v1.8.1 — only the
	 * CATEGORY BLOB counts here; a query that only matches an item rings the
	 * card, not the whole section.
	 */
	highlightedIds: string[];
	/** v1.8.1 — whether a specific card inside a category matches the query. */
	matchesItem: (categoryId: string, itemId: string) => boolean;
	/** v1.8.1 — all matched (categoryId, itemId) pairs, for the card rings. */
	highlightedItemIds: Array<{ categoryId: string; itemId: string }>;
}

export function useCategorySearch(
	categories: CategorySearchInput[],
): CategorySearchState {
	const [query, setQuery] = useState("");
	const [activeId, setActiveId] = useState(categories[0]?.id ?? "");
	const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
	const [highlightedItemIds, setHighlightedItemIds] = useState<
		Array<{ categoryId: string; itemId: string }>
	>([]);

	const normalized = query.trim().toLowerCase();

	const matches = (id: string): boolean => {
		if (normalized === "") return true;
		const cat = categories.find((c) => c.id === id);
		if ((cat?.search ?? "").includes(normalized)) return true;
		return (cat?.items ?? []).some((it) => it.search.includes(normalized));
	};

	const matchesItem = (categoryId: string, itemId: string): boolean =>
		normalized !== "" &&
		(
			categories
				.find((c) => c.id === categoryId)
				?.items?.find((it) => it.id === itemId)?.search ?? ""
		).includes(normalized);

	const visibleCount =
		normalized === ""
			? categories.length
			: categories.filter((c) => matches(c.id)).length;

	const select = (id: string) => {
		setActiveId(id);
		const el = document.getElementById(id);
		if (el && typeof el.scrollIntoView === "function") {
			el.scrollIntoView({ behavior: "smooth" });
		}
	};

	// On every query change: highlight the matching sections (live) so the
	// user sees what matches while typing. Scrolling to the first match is
	// deferred to `focusFirstMatch()` (Enter / the search button).
	useEffect(() => {
		if (normalized === "") {
			setHighlightedIds([]);
			setHighlightedItemIds([]);
			return;
		}
		// v1.8.1 — the category ring only fires on a CATEGORY blob match; a
		// query that only matches an item rings the card instead.
		const matched = categories
			.filter((c) => c.search.includes(normalized))
			.map((c) => c.id);
		setHighlightedIds(matched);
		const items: Array<{ categoryId: string; itemId: string }> = [];
		for (const c of categories) {
			for (const it of c.items ?? []) {
				if (it.search.includes(normalized)) {
					items.push({ categoryId: c.id, itemId: it.id });
				}
			}
		}
		setHighlightedItemIds(items);
	}, [normalized]);

	// Track the in-view category while scrolling; if none is in the active
	// band, keep the last one highlighted.
	useEffect(() => {
		if (typeof IntersectionObserver === "undefined") return;
		const nodes = categories
			.map((c) => document.getElementById(c.id))
			.filter((el): el is HTMLElement => el !== null);
		if (nodes.length === 0) return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) setActiveId(entry.target.id);
				}
			},
			{ rootMargin: "-40% 0px -55% 0px" },
		);
		nodes.forEach((el) => observer.observe(el));
		return () => observer.disconnect();
	}, [categories]);

	// Scroll the first matching category into view. Deliberately a separate
	// action from typing (v1.8.0): the page calls it on Enter / the search
	// button, or skips it entirely when a cross-page hint takes priority.
	const focusFirstMatch = () => {
		if (normalized === "") return;
		const first = categories.find((c) => matches(c.id));
		if (!first) return;
		const el = document.getElementById(first.id);
		if (el && typeof el.scrollIntoView === "function") {
			el.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	};

	return {
		query,
		setQuery,
		activeId,
		select,
		focusFirstMatch,
		dimmedIds:
			normalized === ""
				? []
				: categories.filter((c) => !matches(c.id)).map((c) => c.id),
		noResults: normalized !== "" && visibleCount === 0,
		matches,
		highlightedIds,
		matchesItem,
		highlightedItemIds,
	};
}
