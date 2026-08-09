import { describe, expect, it } from "vitest";
import { findCrossPageTopic } from "./cross-page-search.js";

/** Minimal `t` — resolves the few keys the topics use, English defaults. */
function t(key: string): string {
	return (
		{
			"settings.searchCrossLanguage":
				"language languages app language ui language",
			"settings.searchCrossAi":
				"ai output output language intelligence language ai language",
			"settings.searchCrossIdentity":
				"identity who you are interests behavior summary",
			"settings.searchCrossReading": "reading reader font font size card click",
			"settings.searchCrossSettings":
				"updates update theme appearance storage usage notifications mode",
			"profile.categoryLanguages": "Languages",
			"profile.categoryAi": "How the AI writes",
			"profile.categoryIdentity": "Who you are",
			"profile.categoryReading": "Reading",
			"settings.title": "Settings",
		}[key] ?? key
	);
}

describe("cross-page search (v1.8.0)", () => {
	it("points settings search at profile topics", () => {
		const topic = findCrossPageTopic("language", "/settings", t);
		expect(topic?.page).toBe("/profile");
		expect(topic?.sectionId).toBe("profile-languages");
	});

	it("points profile search at settings topics", () => {
		const topic = findCrossPageTopic("update", "/profile", t);
		expect(topic?.page).toBe("/settings");
		expect(topic?.sectionId).toBe("settings-general");
	});

	it("never suggests the page you are already on", () => {
		expect(findCrossPageTopic("language", "/profile", t)).toBeNull();
		expect(findCrossPageTopic("theme", "/settings", t)).toBeNull();
	});

	it("returns null for empty or unmatched queries", () => {
		expect(findCrossPageTopic("", "/settings", t)).toBeNull();
		expect(findCrossPageTopic("zzzz-not-a-thing", "/settings", t)).toBeNull();
	});

	it("matches the selected UI language when a resolver is passed", () => {
		// Persian UI: "زبان" (language) and "فونت" (font) match their topics.
		const persian = (key: string) =>
			({
				"settings.searchCrossLanguage":
					"زبان زبان‌ها زبان برنامه زبان رابط language",
				"settings.searchCrossReading":
					"خواندن مطالعه فونت اندازه فونت کلیک کارت reading font",
				"profile.categoryLanguages": "زبان‌ها",
				"profile.categoryReading": "خواندن",
			})[key] ?? t(key);
		expect(findCrossPageTopic("زبان", "/settings", persian)?.sectionId).toBe(
			"profile-languages",
		);
		expect(findCrossPageTopic("فونت", "/settings", persian)?.sectionId).toBe(
			"profile-reading",
		);
	});

	it("keeps working without a resolver (English keywords only)", () => {
		expect(findCrossPageTopic("language", "/settings")?.sectionId).toBe(
			"profile-languages",
		);
	});
});
