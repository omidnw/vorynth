import { ApiAdapter } from "../../src/modules/crawler/adapters/api-adapter.js";

/** Offline tests for the generic JSON API adapter — mocked fetch only. */

const JSON_RESPONSE = {
	items: [
		{
			id: 1,
			title: "Alpha",
			body: "alpha body",
			link: "https://x.com/1",
			published_at: "2026-08-01T00:00:00Z",
			author: { name: "Ann" },
		},
		{
			id: 2,
			title: "Beta",
			body: "beta body",
			link: "https://x.com/2",
			published_at: "2026-08-02T00:00:00Z",
			author: { name: "Bob" },
		},
		{ id: 3, title: "", body: "empty title", link: "https://x.com/3" },
	],
};

function mockFetch(json: unknown, status = 200): void {
	globalThis.fetch = jest.fn(async () => {
		if (status !== 200) return new Response("", { status, ok: false });
		return new Response(JSON.stringify(json), { status: 200 });
	}) as unknown as typeof fetch;
}

describe("ApiAdapter", () => {
	let adapter: ApiAdapter;
	beforeEach(() => {
		adapter = new ApiAdapter();
	});

	describe("validate", () => {
		it("requires apiUrl + titleField", () => {
			expect(
				adapter.validate({
					api: { apiUrl: "https://api.x.com", titleField: "title" },
				}),
			).toBe(true);
			expect(adapter.validate({ api: { apiUrl: "https://api.x.com" } })).toBe(
				false,
			);
			expect(adapter.validate({})).toBe(false);
		});
	});

	describe("fetch", () => {
		it("maps records via field paths incl. dotted author path", async () => {
			mockFetch(JSON_RESPONSE);
			const items = await adapter.fetch({
				api: {
					apiUrl: "https://api.x.com/list",
					itemsPath: "items",
					titleField: "title",
					contentField: "body",
					urlField: "link",
					dateField: "published_at",
					authorField: "author.name",
				},
			});
			expect(items).toHaveLength(2); // empty title record is skipped
			expect(items[0]).toMatchObject({
				title: "Alpha",
				content: "alpha body",
				url: "https://x.com/1",
				author: "Ann",
			});
			expect(items[0]?.publishedAt?.toISOString()).toBe(
				"2026-08-01T00:00:00.000Z",
			);
		});

		it("treats the top-level JSON as the array when no itemsPath", async () => {
			mockFetch([{ title: "Solo" }, { title: "Duo" }]);
			const items = await adapter.fetch({
				api: { apiUrl: "https://api.x.com", titleField: "title" },
			});
			expect(items).toHaveLength(2);
			expect(items[0]?.title).toBe("Solo");
		});

		it("sends configured headers and returns [] on HTTP error", async () => {
			mockFetch(null, 500);
			const items = await adapter.fetch({
				api: {
					apiUrl: "https://api.x.com",
					titleField: "title",
					headers: { Authorization: "Bearer abc" },
				},
			});
			expect(items).toHaveLength(0);
			const call = (globalThis.fetch as jest.Mock).mock.calls[0];
			expect(call[1].headers.Authorization).toBe("Bearer abc");
		});

		it("drops records whose date can't be parsed instead of crashing the run", async () => {
			mockFetch([
				{ title: "Good", published_at: "2026-08-01T00:00:00Z" },
				{ title: "Bad date", published_at: "yesterday" },
				{ title: "No date" },
			]);
			const items = await adapter.fetch({
				api: {
					apiUrl: "https://api.x.com",
					titleField: "title",
					dateField: "published_at",
				},
			});
			expect(items).toHaveLength(3);
			const good = items.find((i) => i.title === "Good");
			// survived with a real date
			expect(good?.publishedAt?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
			// the unparseable date degrades to undefined, never an Invalid Date
			expect(items.find((i) => i.title === "Bad date")?.publishedAt).toBe(
				undefined,
			);
			expect(items.find((i) => i.title === "No date")?.publishedAt).toBe(
				undefined,
			);
		});
	});
});
