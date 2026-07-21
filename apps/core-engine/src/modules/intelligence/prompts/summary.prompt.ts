import type { BriefPeriod } from "@vorynth/types";

/**
 * Period-summary prompt — used by `IntelligenceService.summarizePeriod()`.
 *
 * Bundles the period's headlines into one call and asks for a rich,
 * multi-point intelligence briefing WITH citations: every claim must be tagged
 * with `[N]` referring to the numbered article in the context. The backend
 * then resolves those `[N]` markers to real `Citation` objects the frontend
 * renders as hoverable chips.
 *
 * The output shape is summary-specific (arrays of takeaways / actions / themes
 * with rationale) — NOT the flat per-article `InsightDraft`. It is parsed by
 * {@link parseSummaryDraft} and must stay in sync with that parser.
 */
export function buildSummaryPrompt(opts: {
	period: BriefPeriod;
	targetLanguage: string;
	stories: Array<{
		title: string;
		category: string;
		source: string;
		when: string;
	}>;
}): { system: string; user: string } {
	const periodLabel =
		opts.period === "today"
			? "today"
			: opts.period === "week"
				? "this week"
				: opts.period === "month"
					? "this month"
					: "recently";

	const system = [
		"You are Vorynth, a personal intelligence engine.",
		`Synthesize the user's ${periodLabel} feed into ONE cohesive, multi-point intelligence briefing.`,
		"You are NOT summarizing individual articles — you are finding the through-lines across the period,",
		"the distinct themes that emerged, the concrete takeaways a technical professional should retain,",
		"and the 2-3 most useful next actions to take.",
		"",
		"DEPTH GUIDANCE — scale your output to the feed size:",
		"- For ≤5 stories: 3 takeaways, 1-2 actions, 3-4 themes.",
		"- For 6-15 stories: 4-5 takeaways, 2-3 actions, 4-5 themes.",
		"- For 16+ stories: 5-6 takeaways, 2-3 actions, 5-6 themes.",
		"Each takeaway should be a distinct insight (not a restatement of another), 1-2 sentences.",
		"Each recommended action must be concrete and immediately actionable — not vague advice.",
		"Each theme must carry a one-sentence rationale explaining WHY these stories cluster together",
		"(not just a category label — the semantic through-line).",
		"",
		"TONE: Be precise, technical, and direct. No marketing language. No hedging.",
		`Write every human-readable field in: ${opts.targetLanguage}.`,
		"Technical terms (library names, CVE IDs, model names) stay in their original form.",
		"",
		"CRITICAL — CITATIONS:",
		"Every factual claim in headline/takeaways/recommendedActions/themes[].rationale MUST be followed",
		"by a `[N]` citation referring to the numbered article it came from.",
		"For example: 'OpenAI released a new reasoning model [1] that closes the gap with Anthropic on",
		"coding benchmarks [2].' If a claim synthesizes multiple stories, combine them in one bracket,",
		"comma-separated: '[1,3,5]'. Only cite articles present in the context.",
		"Aim to cite at least half of the provided stories somewhere in your output.",
	].join("\n");

	const lines = opts.stories.map(
		(s, i) => `[${i + 1}] (${s.category}) ${s.title} — ${s.source}, ${s.when}`,
	);
	const user = [
		`The following ${opts.stories.length} stories were collected ${periodLabel}:`,
		"",
		...lines,
		"",
		"Return ONLY a JSON object with this exact shape, no prose, no code fences:",
		"{",
		'  "headline": "1-2 sentence synthesis of the period\'s most important arc, with [N] citations",',
		'  "themes": [',
		'    {"name": "short theme label", "rationale": "one sentence on why these stories cluster, with [N] citations"}',
		"  ],",
		'  "takeaways": [',
		'    "a distinct insight the reader should retain, 1-2 sentences, with [N] citations"',
		"  ],",
		'  "recommendedActions": [',
		'    "a concrete, immediately actionable next step, with [N] citations"',
		"  ],",
		'  "importanceScore": <number 0-10, overall strategic weight of the period>,',
		'  "category": "the dominant category across these stories"',
		"}",
	].join("\n");

	return { system, user };
}

/**
 * Parsed shape of the model's period-summary JSON response. Mirrors the schema
 * in {@link buildSummaryPrompt} and is summary-specific (arrays + theme
 * rationale), distinct from the flat per-article `InsightDraft`.
 */
export interface SummaryDraft {
	headline: string;
	themes: { name: string; rationale: string }[];
	takeaways: string[];
	recommendedActions: string[];
	importanceScore: number;
	category: string;
}

/**
 * Parse the model's period-summary JSON response into a {@link SummaryDraft}.
 *
 * Tolerates the same quirks as the per-article `parseDraft` (stray code fences,
 * leading/trailing prose) and coerces types defensively so a malformed response
 * degrades to empty arrays rather than throwing. Empty / non-string array
 * entries are dropped after trimming.
 */
export function parseSummaryDraft(raw: string): SummaryDraft {
	let text = raw.trim();
	const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fence && fence[1]) text = fence[1].trim();

	let obj: Record<string, unknown>;
	try {
		obj = JSON.parse(text);
	} catch {
		const match = text.match(/\{[\s\S]*\}/);
		if (!match) {
			return {
				headline: raw.slice(0, 200),
				themes: [],
				takeaways: [],
				recommendedActions: [],
				importanceScore: 0,
				category: "other",
			};
		}
		obj = JSON.parse(match[0]);
	}

	const score = Number(obj.importanceScore ?? 0);
	return {
		headline: String(obj.headline ?? ""),
		themes: cleanThemes(obj.themes),
		takeaways: cleanStringArray(obj.takeaways),
		recommendedActions: cleanStringArray(obj.recommendedActions),
		importanceScore: Number.isFinite(score)
			? Math.max(0, Math.min(10, score))
			: 0,
		category: String(obj.category ?? "other"),
	};
}

/** Coerce an unknown value into a clean `{name, rationale}[]`. */
function cleanThemes(value: unknown): { name: string; rationale: string }[] {
	if (!Array.isArray(value)) return [];
	const out: { name: string; rationale: string }[] = [];
	for (const item of value) {
		if (typeof item !== "object" || item === null) continue;
		const name = String((item as Record<string, unknown>).name ?? "").trim();
		if (!name) continue;
		const rationale = String(
			(item as Record<string, unknown>).rationale ?? "",
		).trim();
		out.push({ name, rationale });
	}
	return out;
}

/** Coerce an unknown value into a clean, trimmed, non-empty `string[]`. */
function cleanStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map((v) => String(v ?? "").trim()).filter((s) => s.length > 0);
}
