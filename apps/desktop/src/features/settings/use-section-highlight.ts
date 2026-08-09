import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * `?section=<categoryId>` deep-link support (v1.8.0).
 *
 * The cross-page search hint navigates to e.g. `/profile?section=profile-languages`;
 * this hook reads that param, smooth-scrolls the section into view, and keeps
 * it ring-highlighted for a few seconds so the user lands exactly on the thing
 * they searched for.
 */
export function useSectionHighlight(): string | null {
	const [params] = useSearchParams();
	const section = params.get("section");
	const [highlighted, setHighlighted] = useState<string | null>(null);

	useEffect(() => {
		if (!section) return;
		const el = document.getElementById(section);
		if (!el) return;
		if (typeof el.scrollIntoView === "function") {
			el.scrollIntoView({ behavior: "smooth", block: "start" });
		}
		setHighlighted(section);
		const timer = setTimeout(() => setHighlighted(null), 4000);
		return () => clearTimeout(timer);
	}, [section]);

	return highlighted;
}
