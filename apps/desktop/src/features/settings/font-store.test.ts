import { beforeEach, describe, expect, it } from "vitest";
import { FONT_SCALE_MAX, FONT_SCALE_MIN, useFontStore } from "./font-store.js";

describe("font store (v1.8.0)", () => {
	beforeEach(() => {
		useFontStore.setState({ family: null, scale: 1 });
	});

	it("sets and persists the family", () => {
		useFontStore.getState().setFamily("Inter");
		expect(useFontStore.getState().family).toBe("Inter");
		expect(window.localStorage.getItem("vorynth.fontFamily")).toBe("Inter");
	});

	it("clamps the scale to the allowed range", () => {
		useFontStore.getState().setScale(2.5);
		expect(useFontStore.getState().scale).toBe(FONT_SCALE_MAX);
		useFontStore.getState().setScale(0.1);
		expect(useFontStore.getState().scale).toBe(FONT_SCALE_MIN);
	});

	it("resets to defaults", () => {
		useFontStore.getState().setFamily("Inter");
		useFontStore.getState().setScale(1.2);
		useFontStore.getState().reset();
		expect(useFontStore.getState()).toMatchObject({ family: null, scale: 1 });
	});
});
