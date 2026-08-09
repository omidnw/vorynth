/**
 * Cross-page search hints (v1.8.0).
 *
 * Settings and Profile each have their own search, but some settings live on
 * the other page (language + AI output language live on Profile; updates /
 * theme / storage live in Settings). When a query matches nothing here but
 * matches a topic that lives over there, the page renders a hint card — "This
 * is on the Profile page" — with a Go button that navigates to
 * `/profile?section=…`, and the target page scrolls to + highlights that
 * section.
 *
 * Matching is bilingual (v1.8.0): the English `keywords` always apply, and
 * `findCrossPageTopic` additionally matches the topic's keywords + label in
 * the current UI language (resolved through `t`), so e.g. "زبان" finds the
 * language hint when the app speaks Persian.
 */

/** Minimal `t` shape — matches react-i18next's `t` as threaded through. */
type Translate = (key: string) => string;

export interface CrossPageTopic {
	/** English keywords — always matched, any UI language. */
	keywords: string[];
	/** i18n key for the topic's keywords in the selected UI language. */
	keywordsKey: string;
	/** The page where this setting actually lives. */
	page: "/settings" | "/profile";
	/** Category id on the target page to scroll to. */
	sectionId: string;
	/** i18n key for the section label, resolved on the source page. */
	labelKey: string;
}

export const CROSS_PAGE_TOPICS: CrossPageTopic[] = [
	// Settings search → these live on the Profile page.
	{
		keywords: ["language", "languages", "app language", "ui language"],
		keywordsKey: "settings.searchCrossLanguage",
		page: "/profile",
		sectionId: "profile-languages",
		labelKey: "profile.categoryLanguages",
	},
	{
		keywords: [
			"ai output",
			"output language",
			"intelligence language",
			"ai language",
		],
		keywordsKey: "settings.searchCrossAi",
		page: "/profile",
		sectionId: "profile-ai",
		labelKey: "profile.categoryAi",
	},
	{
		keywords: ["identity", "who you are", "interests", "behavior summary"],
		keywordsKey: "settings.searchCrossIdentity",
		page: "/profile",
		sectionId: "profile-identity",
		labelKey: "profile.categoryIdentity",
	},
	{
		keywords: ["reading", "reader", "font", "font size", "card click"],
		keywordsKey: "settings.searchCrossReading",
		page: "/profile",
		sectionId: "profile-reading",
		labelKey: "profile.categoryReading",
	},
	// Profile search → these live in Settings.
	{
		keywords: [
			"updates",
			"update",
			"theme",
			"appearance",
			"storage",
			"usage",
			"notifications",
			"mode",
		],
		keywordsKey: "settings.searchCrossSettings",
		page: "/settings",
		sectionId: "settings-general",
		labelKey: "settings.title",
	},
];

/** The topic that lives on the OTHER page and matches the query, if any. */
export function findCrossPageTopic(
	query: string,
	from: "/settings" | "/profile",
	t?: Translate,
): CrossPageTopic | null {
	const q = query.trim().toLowerCase();
	if (!q) return null;
	for (const topic of CROSS_PAGE_TOPICS) {
		if (topic.page === from) continue;
		// English keywords keep the original per-keyword substring semantics.
		const englishMatch = topic.keywords.some(
			(k) => k.includes(q) || q.includes(k),
		);
		// The topic's keywords + label in the selected UI language (when a `t`
		// resolver is available) match when the query appears inside them.
		const localized = t
			? [t(topic.keywordsKey), t(topic.labelKey)].join(" ").toLowerCase()
			: "";
		const localizedMatch = localized !== "" && localized.includes(q);
		if (englishMatch || localizedMatch) return topic;
	}
	return null;
}
