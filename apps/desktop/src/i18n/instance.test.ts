import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_LOCALE_KEY } from "./instance.js";
import { fa } from "./fa.js";

/**
 * Startup language seeding — the persisted UI language must be loaded when the
 * i18next instance boots, not switched in after first paint. Regression guard:
 * the instance used to hardcode `lng: "en"`, so a user who chose فارسی would
 * reopen the app with RTL layout and an English UI until they re-picked the
 * language.
 */

function flushMicrotasks(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("startup language seeding", () => {
	beforeEach(() => {
		window.localStorage.clear();
		vi.resetModules();
	});

	afterEach(() => {
		window.localStorage.clear();
	});

	it("boots i18next in the persisted language and resolves its catalog", async () => {
		window.localStorage.setItem(ACTIVE_LOCALE_KEY, "fa");
		const { default: i18n } = await import("./instance.js");
		await flushMicrotasks();
		expect(i18n.language).toBe("fa");
		expect(i18n.t("nav.brief")).toBe(fa.nav.brief);
	});

	it("defaults to English when no locale was persisted", async () => {
		const { default: i18n } = await import("./instance.js");
		await flushMicrotasks();
		expect(i18n.language).toBe("en");
		expect(i18n.t("nav.brief")).toBe("Today's Brief");
	});
});
