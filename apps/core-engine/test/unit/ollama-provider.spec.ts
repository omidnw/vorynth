import {
	OllamaProvider,
	normalizeOllamaBaseUrl,
} from "../../src/modules/llm/providers/ollama-provider.js";

/**
 * Ollama provider (v1.8.1) — local vs cloud. The provider calls the native
 * `/api/chat` endpoint directly (no dependency — the project's pnpm trust
 * policy blocks adding @langchain/ollama on chokidar), so these tests prove
 * the URL + auth headers it sends and the base-URL normalization of legacy
 * stored rows.
 */

describe("OllamaProvider — local vs cloud (v1.8.1)", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
	});

	function stubFetch(): {
		calls: Array<{ url: string; headers: Record<string, string> }>;
	} {
		const calls: Array<{ url: string; headers: Record<string, string> }> = [];
		global.fetch = jest.fn(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				calls.push({
					url: String(input),
					headers: (init?.headers ?? {}) as Record<string, string>,
				});
				return new Response(JSON.stringify({ message: { content: "ok" } }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			},
		) as unknown as typeof fetch;
		return { calls };
	}

	it("normalizes legacy /v1 URLs and defaults to the local server", () => {
		expect(normalizeOllamaBaseUrl(undefined)).toBe("http://localhost:11434");
		expect(normalizeOllamaBaseUrl("http://localhost:11434/v1")).toBe(
			"http://localhost:11434",
		);
		expect(normalizeOllamaBaseUrl("https://ollama.com/")).toBe(
			"https://ollama.com",
		);
		expect(normalizeOllamaBaseUrl("http://10.0.0.5:11434/v1/")).toBe(
			"http://10.0.0.5:11434",
		);
	});

	it("cloud sends a bearer key to the native /api/chat endpoint", async () => {
		const { calls } = stubFetch();
		try {
			const cloud = new OllamaProvider({
				baseUrl: "https://ollama.com",
				apiKey: "sk-cloud",
				model: "gpt-oss:120b",
			});
			expect(await cloud.verify()).toBe(true);
			expect(calls[0].url).toBe("https://ollama.com/api/chat");
			expect(calls[0].headers).toMatchObject({
				authorization: "Bearer sk-cloud",
				"content-type": "application/json",
			});
		} finally {
			global.fetch = originalFetch;
		}
	});

	it("local sends no auth header", async () => {
		const { calls } = stubFetch();
		try {
			const local = new OllamaProvider({ baseUrl: "http://localhost:11434" });
			expect(await local.verify()).toBe(true);
			expect(calls[0].url).toBe("http://localhost:11434/api/chat");
			expect(calls[0].headers.authorization).toBeUndefined();
		} finally {
			global.fetch = originalFetch;
		}
	});

	it("a failed round trip makes verify() report false, not throw", async () => {
		global.fetch = jest.fn(async () => {
			return new Response("unauthorized", { status: 401 });
		}) as unknown as typeof fetch;
		const provider = new OllamaProvider({
			baseUrl: "https://ollama.com",
			apiKey: "sk-bad",
		});
		expect(await provider.verify()).toBe(false);
	});

	it("analyze() returns a parsed insight draft from the model JSON", async () => {
		global.fetch = jest.fn(async () => {
			return new Response(
				JSON.stringify({
					message: {
						content:
							'{"summary":"S","significance":"","impact":"","recommendedAction":"","importanceScore":5,"category":"ai"}',
					},
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}) as unknown as typeof fetch;
		const provider = new OllamaProvider({ model: "llama3.2" });
		const draft = await provider.analyze({
			articleTitle: "T",
			articleContent: "C",
			outputLanguage: "en",
		});
		expect(draft).toMatchObject({ summary: "S", importanceScore: 5 });
	});
});
