import { RedditAdapter } from "../../src/modules/crawler/adapters/reddit-adapter.js";

/** Offline tests for the Reddit adapter — mocked fetch only. */

const LISTING = {
	data: {
		children: [
			{
				data: {
					title: "Model X released",
					selftext: "Details here",
					permalink: "/r/ML/comments/1/abc",
					author: "user1",
					created_utc: 1780000000,
				},
			},
			{
				data: {
					title: "Another paper",
					selftext: "",
					permalink: "/r/ML/comments/2/def",
					author: "user2",
					created_utc: 1780001000,
				},
			},
			{ data: { title: "" } }, // empty title → skipped
		],
	},
};

describe("RedditAdapter", () => {
	let adapter: RedditAdapter;
	beforeEach(() => {
		adapter = new RedditAdapter();
	});

	describe("validate", () => {
		it("requires a non-empty subreddit", () => {
			expect(
				adapter.validate({ reddit: { subreddit: "MachineLearning" } }),
			).toBe(true);
			expect(adapter.validate({})).toBe(false);
			expect(adapter.validate({ reddit: { subreddit: "  " } })).toBe(false);
		});
	});

	describe("fetch", () => {
		it("maps posts to articles, converting created_utc and permalink", async () => {
			globalThis.fetch = jest.fn(async () => {
				return new Response(JSON.stringify(LISTING), { status: 200 });
			}) as unknown as typeof fetch;

			const items = await adapter.fetch({
				reddit: { subreddit: "MachineLearning" },
			});
			expect(items).toHaveLength(2);
			expect(items[0]).toMatchObject({
				title: "Model X released",
				content: "Details here",
				author: "user1",
				url: "https://www.reddit.com/r/ML/comments/1/abc",
			});
			expect(items[0]?.publishedAt?.getTime()).toBe(1780000000 * 1000);

			// Correct subreddit is requested with a UA header (Reddit API policy).
			const call = (globalThis.fetch as jest.Mock).mock.calls[0];
			expect(String(call[0])).toContain("/r/MachineLearning/new.json");
			expect(call[1].headers["user-agent"]).toContain("Vorynth");
		});

		it("returns [] on HTTP error", async () => {
			globalThis.fetch = jest.fn(
				async () => new Response("", { status: 403, ok: false }),
			) as unknown as typeof fetch;
			const items = await adapter.fetch({ reddit: { subreddit: "Private" } });
			expect(items).toHaveLength(0);
		});
	});
});
