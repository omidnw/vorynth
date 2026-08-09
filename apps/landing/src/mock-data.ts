import type { BriefEntry } from "@vorynth/types";

/**
 * Static mock data for the landing-page Today's Brief preview. Shapes match
 * `@vorynth/types` exactly so the real `BriefItemView` renders without special
 * handling. One Signal item (with the full intelligence triad) + one Trend
 * item (news mode, no insight) — mirrors the two modes the app shows.
 */
const baseArticle = {
	sourceId: "src-awan",
	url: "https://example.com/langgraph-1-0",
	author: "Awan",
	collectedAt: new Date("2026-08-04T08:00:00Z"),
	hash: "mock-langgraph",
	contentItemId: "ci-1",
};

export const MOCK_SIGNAL_ENTRY: BriefEntry = {
	rank: 1,
	article: {
		id: "art-1",
		title: "LangGraph 1.0: agents that plan before they act",
		content:
			"Agent frameworks have moved from prompting to explicit planning, reshaping how production AI pipelines are built this quarter. The new graph API exposes tool selection and memory as first-class nodes, so multi-step agents can be inspected, replayed, and tested rather than treated as prompt-engineered black boxes.",
		...baseArticle,
		publishedAt: new Date("2026-08-04T07:30:00Z"),
	},
	category: "AI",
	sourceNames: ["Awan LLM Weekly"],
	score: 9.2,
	importanceTier: "signal",
	ranking: { sourceReliability: 0.9, freshnessScore: 9, lengthSignal: 1.4 },
	insight: {
		id: "ins-1",
		clusterId: null,
		articleId: "art-1",
		summary:
			"LangGraph 1.0 ships an explicit planning step for agent workflows.",
		significance:
			"The agent loop now has a plan step, not just a prompt \u2014 tool selection and memory are becoming explicit graphs that can be inspected and replayed.",
		impact:
			"High \u2014 teams evaluating agent frameworks should benchmark the new planner model before their next pipeline rewrite.",
		importanceScore: 9.2,
		importanceTier: "signal",
		category: "AI",
		recommendedAction:
			"Read the migration guide and prototype one existing flow on the new graph API to gauge the rewrite cost.",
		generatedLanguage: "en",
		originalSummary: null,
		originalSignificance: null,
		originalImpact: null,
		originalRecommendedAction: null,
		createdAt: new Date("2026-08-04T08:05:00Z"),
	},
};

export const MOCK_TREND_ENTRY: BriefEntry = {
	rank: 2,
	article: {
		id: "art-2",
		title: "SQLite 4.0 quietly ships with async I/O",
		content:
			"Embedded databases are shedding their synchronous limits \u2014 a change worth benchmarking before the next migration decision. Early benchmarks show meaningful throughput gains on write-heavy workloads without sacrificing the durability guarantees SQLite is known for.",
		sourceId: "src-db",
		url: "https://example.com/sqlite-4-async",
		author: "Database Digest",
		publishedAt: new Date("2026-08-04T05:00:00Z"),
		collectedAt: new Date("2026-08-04T08:00:00Z"),
		hash: "mock-sqlite",
		contentItemId: "ci-2",
	},
	category: "Backend",
	sourceNames: ["Database Digest"],
	score: 7.1,
	importanceTier: "trend",
	ranking: { sourceReliability: 0.85, freshnessScore: 7, lengthSignal: 1.2 },
	insight: null,
};

export const MOCK_ENTRIES: BriefEntry[] = [MOCK_SIGNAL_ENTRY, MOCK_TREND_ENTRY];

export const MOCK_SECURITY_ENTRY: BriefEntry = {
	rank: 3,
	article: {
		id: "art-3",
		title: "Critical OpenSSH flaw ships with a silent patch",
		content:
			"A memory-safety bug in the SSH daemon's argument parsing shipped quietly this week. Upgrading is strongly recommended for exposed hosts, and the patch is already in most package managers.",
		sourceId: "src-sec",
		url: "https://example.com/openssh-silent-patch",
		author: "Security Now",
		publishedAt: new Date("2026-08-03T18:00:00Z"),
		collectedAt: new Date("2026-08-04T08:00:00Z"),
		hash: "mock-openssh",
		contentItemId: "ci-3",
	},
	category: "security",
	sourceNames: ["Security Now"],
	score: 8.8,
	importanceTier: "signal",
	ranking: { sourceReliability: 0.95, freshnessScore: 8, lengthSignal: 1.1 },
	insight: {
		id: "ins-3",
		clusterId: null,
		articleId: "art-3",
		summary: "A critical SSH daemon fix was released without a headline.",
		significance:
			"Argument-parsing memory bugs in the daemon are remotely triggerable in common configs \u2014 this one deserves the same urgency as a named CVE.",
		impact:
			"Critical for internet-facing SSH servers; patch within 48 hours and audit fail2ban rules that may mask the new logging.",
		importanceScore: 8.8,
		importanceTier: "signal",
		category: "security",
		recommendedAction:
			"Upgrade openssh-server on every exposed host and verify the new version in your config-management state.",
		generatedLanguage: "en",
		originalSummary: null,
		originalSignificance: null,
		originalImpact: null,
		originalRecommendedAction: null,
		createdAt: new Date("2026-08-04T08:05:00Z"),
	},
};

export const MOCK_RISCV_ENTRY: BriefEntry = {
	rank: 4,
	article: {
		id: "art-4",
		title: "RISC-V laptops finally scale past the niche",
		content:
			"Mainstream vendors are shipping ARM-beating efficiency claims on RISC-V silicon, and developer toolchains are catching up fast enough to make daily-driver use plausible within a year.",
		sourceId: "src-hw",
		url: "https://example.com/riscv-laptops-scale",
		author: "Hardware Signals",
		publishedAt: new Date("2026-08-02T09:00:00Z"),
		collectedAt: new Date("2026-08-04T08:00:00Z"),
		hash: "mock-riscv",
		contentItemId: "ci-4",
	},
	category: "other",
	sourceNames: ["Hardware Signals"],
	score: 6.4,
	importanceTier: "trend",
	ranking: { sourceReliability: 0.8, freshnessScore: 6, lengthSignal: 1.3 },
	insight: null,
};
