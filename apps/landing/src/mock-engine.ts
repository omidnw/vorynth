import type { TodaysBrief } from "@vorynth/types";
import {
	MOCK_RISCV_ENTRY,
	MOCK_SECURITY_ENTRY,
	MOCK_SIGNAL_ENTRY,
	MOCK_TREND_ENTRY,
} from "./mock-data";

/**
 * Static engine for the landing preview. The preview renders the REAL desktop
 * ShellLayout + BriefPage, which call the engine through `apiFetch` (a plain
 * `fetch` against http://127.0.0.1:34117). This installs a `fetch` stub that
 * returns mock JSON keyed by URL path, so the real screens render with realistic
 * data and no engine.
 *
 * The brief is period-aware (Today / This Week / This Month / All Time), so the
 * real Range pills are genuinely interactive; scores/dates are varied so the
 * Sort pills visibly reorder items too.
 *
 * Only the paths the preview actually queries are given data; everything else
 * returns an empty JSON object (queries degrade to empty states silently).
 */
const ROUTES: Array<{
	test: (path: string) => boolean;
	data: (path: string) => unknown;
}> = [
	{ test: (p) => p.startsWith("/reports/range"), data: (p) => briefFor(p) },
	{
		test: (p) => p.startsWith("/profile"),
		data: () => ({
			id: "local",
			alias: "Omid",
			firstName: "Omid",
			lastName: null,
		}),
	},
	{
		test: (p) => p.startsWith("/jobs"),
		data: () => ({ active: [], recent: [] }),
	},
	{ test: (p) => p.startsWith("/bookmarks"), data: () => ({ items: [] }) },
	{ test: (p) => p.startsWith("/plugins"), data: () => [] },
];

/** `/reports/range?period=X` → a TodaysBrief for that period. */
function briefFor(path: string): TodaysBrief {
	const period =
		new URL(path, "http://mock").searchParams.get("period") ?? "today";
	const entries =
		period === "today"
			? [MOCK_SIGNAL_ENTRY, MOCK_TREND_ENTRY]
			: period === "week"
				? [MOCK_SECURITY_ENTRY, MOCK_SIGNAL_ENTRY, MOCK_TREND_ENTRY]
				: [
						MOCK_SECURITY_ENTRY,
						MOCK_SIGNAL_ENTRY,
						MOCK_TREND_ENTRY,
						MOCK_RISCV_ENTRY,
					];
	return {
		report: null,
		entries: entries.map((e, i) => ({ ...e, rank: i + 1 })),
		totalStories: period === "today" ? 12 : period === "week" ? 48 : 214,
		totalSources: 8,
		intelligenceEnabled: true,
		generatedAt: new Date("2026-08-04T08:05:00Z"),
	};
}

export function installMockEngine(): void {
	if (globalThis.fetch === mockFetch) return;
	globalThis.fetch = mockFetch;
}

function mockFetch(
	input: RequestInfo | URL,
	_init?: RequestInit,
): Promise<Response> {
	const url =
		typeof input === "string"
			? input
			: input instanceof URL
				? input.toString()
				: input.url;
	let path = "";
	try {
		path = new URL(url).pathname;
	} catch {
		path = url.split("?")[0] ?? "";
	}

	const route = ROUTES.find((r) => r.test(path));
	// Default to `{ items: [] }` — list-shaped queries degrade to empty safely
	// (several real hooks do `data.items.some(...)` / `.map(...)`).
	const body = route ? route.data(path) : { items: [] };

	return Promise.resolve(
		new Response(JSON.stringify(body), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}),
	);
}
