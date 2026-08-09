import type { ExportableContent, PeriodSummary } from "@vorynth/types";

/**
 * Builds the generic export payload for a period briefing (v1.8.0). Used by the
 * Brief page's period panel and the History brief detail page — one exporter,
 * one payload shape.
 */
export function periodSummaryExportContent(
	summary: PeriodSummary,
): ExportableContent {
	const main = [
		summary.headline,
		summary.themes.length > 0
			? `Themes:\n${summary.themes
					.map(
						(th) => `- ${th.name}${th.rationale ? ` — ${th.rationale}` : ""}`,
					)
					.join("\n")}`
			: undefined,
		summary.takeaways.length > 0
			? `Takeaways:\n${summary.takeaways
					.map((tk, i) => `${i + 1}. ${tk}`)
					.join("\n")}`
			: undefined,
		summary.recommendedActions.length > 0
			? `Recommended actions:\n${summary.recommendedActions
					.map((a, i) => `${i + 1}. ${a}`)
					.join("\n")}`
			: undefined,
		summary.citations.length > 0
			? `Sources:\n${summary.citations
					.map((c) => `[${c.n}] ${c.title} — ${c.sourceName}\n${c.url}`)
					.join("\n")}`
			: undefined,
	]
		.filter(Boolean)
		.join("\n\n");

	// v1.8.0 — bilingual summary: when a distinct original-language version
	// exists, export it beneath a divider (mirrors the insight export).
	const original =
		summary.originalHeadline && summary.originalHeadline !== summary.headline
			? [
					`In the original language (${
						summary.originalLanguage ?? "majority of the stories"
					}):`,
					summary.originalHeadline,
					summary.originalThemes && summary.originalThemes.length > 0
						? `Themes:\n${summary.originalThemes
								.map(
									(th) =>
										`- ${th.name}${th.rationale ? ` — ${th.rationale}` : ""}`,
								)
								.join("\n")}`
						: undefined,
					summary.originalTakeaways && summary.originalTakeaways.length > 0
						? `Takeaways:\n${summary.originalTakeaways
								.map((tk, i) => `${i + 1}. ${tk}`)
								.join("\n")}`
						: undefined,
					summary.originalRecommendedActions &&
					summary.originalRecommendedActions.length > 0
						? `Recommended actions:\n${summary.originalRecommendedActions
								.map((a, i) => `${i + 1}. ${a}`)
								.join("\n")}`
						: undefined,
				]
					.filter(Boolean)
					.join("\n\n")
			: "";

	return {
		kind: "other",
		title: summary.headline,
		body: [main, ...(original ? ["---", original] : [])].join("\n\n"),
	};
}
