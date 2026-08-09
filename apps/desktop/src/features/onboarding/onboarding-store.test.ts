import { beforeEach, describe, expect, it } from "vitest";
import {
	getOnboardingStatus,
	markOnboardingDone,
	markOnboardingSkipped,
	resetOnboarding,
	resolveHomePath,
} from "./onboarding-store.js";

beforeEach(() => localStorage.clear());

describe("onboarding-store", () => {
	it("defaults to pending when nothing is stored", () => {
		expect(getOnboardingStatus()).toBe("pending");
	});

	it("marks the flow done or skipped", () => {
		markOnboardingDone();
		expect(getOnboardingStatus()).toBe("done");
		markOnboardingSkipped();
		expect(getOnboardingStatus()).toBe("skipped");
	});

	it("reset returns to pending (welcome shows on next launch)", () => {
		markOnboardingSkipped();
		resetOnboarding();
		expect(getOnboardingStatus()).toBe("pending");
	});
});

describe("resolveHomePath — first-launch detection", () => {
	it("sends a never-decided user to the welcome flow", () => {
		expect(resolveHomePath("pending")).toBe("/onboarding");
	});

	it("sends a completed or skipped user straight to the brief", () => {
		expect(resolveHomePath("done")).toBe("/brief");
		expect(resolveHomePath("skipped")).toBe("/brief");
	});
});
