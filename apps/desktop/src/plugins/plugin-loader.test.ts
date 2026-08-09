import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	__setImportImpl,
	clearPluginCache,
	loadPluginBundle,
} from "@/plugins/plugin-loader.js";

/**
 * Runtime plugin loader — offline unit tests. Stubs `fetch` (bundle text) and
 * the dynamic-import step (node's vitest runner can't import blob: URLs).
 */
vi.mock("@vorynth/types", () => ({}));

function mockFetchWithCode(code: string, status = 200): void {
	globalThis.fetch = vi.fn(async () => {
		if (status !== 200) return new Response("", { status });
		return new Response(code, { status: 200 });
	}) as unknown as typeof fetch;
}

describe("loadPluginBundle", () => {
	beforeEach(() => {
		clearPluginCache();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("loads an ESM bundle and caches it per plugin id", async () => {
		mockFetchWithCode("export const navItems = [];");
		__setImportImpl(async () => ({
			navItems: [{ id: "a", label: "A", icon: "x" }],
		}));

		const first = await loadPluginBundle("reference");
		expect(first?.navItems).toEqual([{ id: "a", label: "A", icon: "x" }]);

		// Second call hits the cache — fetch is not called again.
		await loadPluginBundle("reference");
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it("returns null (no throw) when the bundle is missing", async () => {
		mockFetchWithCode("", 404);
		__setImportImpl(async () => ({}));
		await expect(loadPluginBundle("ghost")).resolves.toBeNull();
	});

	it("returns null when the module import fails", async () => {
		mockFetchWithCode("not javascript");
		__setImportImpl(async () => {
			throw new Error("boom");
		});
		await expect(loadPluginBundle("broken")).resolves.toBeNull();
	});

	it("caches the null result for a missing plugin", async () => {
		mockFetchWithCode("", 404);
		__setImportImpl(async () => ({}));
		await loadPluginBundle("ghost");
		await loadPluginBundle("ghost");
		// 404 cached after the first attempt — only one fetch.
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it("fetches an installed plugin's bundle from the engine URL", async () => {
		const fetchMock = vi.fn(
			async () => new Response("export {};", { status: 200 }),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		__setImportImpl(async () => ({
			navItems: [{ id: "a", label: "A", icon: "x" }],
		}));

		const result = await loadPluginBundle(
			"hello",
			"http://localhost:34117/plugins/hello/bundle",
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"http://localhost:34117/plugins/hello/bundle",
		);
		expect(result?.navItems).toEqual([{ id: "a", label: "A", icon: "x" }]);
	});

	it("uses the static bundle path for built-ins by default", async () => {
		const fetchMock = vi.fn(
			async () => new Response("export {};", { status: 200 }),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		__setImportImpl(async () => ({}));

		await loadPluginBundle("reference");
		expect(fetchMock).toHaveBeenCalledWith("/plugins/reference/bundle.js");
	});
});
