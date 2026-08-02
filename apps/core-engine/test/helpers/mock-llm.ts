import type {
	InsightDraft,
	LlmProvider,
} from "../../src/modules/llm/llm-provider.js";

/**
 * A deterministic, offline `LlmProvider` for tests. Tests must never hit the
 * network — services under test receive this mock instead of a real provider.
 *
 * Every method is a `jest.fn` so callers can assert on invocation counts and
 * args; pass `overrides` to stub a specific return value or a failure.
 */
export function createMockLlmProvider(
	overrides: Partial<LlmProvider> = {},
): LlmProvider {
	const draft: InsightDraft = {
		summary: "Test summary",
		significance: "Why it matters (test)",
		impact: "Impact (test)",
		recommendedAction: "Recommended action (test)",
		importanceScore: 7,
		category: "ai",
	};
	return {
		kind: "ollama",
		verify: jest.fn(async () => true),
		analyze: jest.fn(async () => draft),
		generate: jest.fn(async () => "Generated text (test)"),
		...overrides,
	} as LlmProvider;
}
