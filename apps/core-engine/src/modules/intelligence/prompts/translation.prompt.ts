/**
 * Story-translation prompt + batch parser — used by
 * `IntelligenceService.translateAllStories()`.
 *
 * Translate Stories sends several stories per LLM call (5 by default) and
 * asks for a JSON array back — one `{id, title, content}` object per input,
 * keyed by article id so a mis-ordered or partial response still applies
 * safely. Since v1.8.0 each item may also carry the story's AI insight
 * (`insight: {summary, significance, impact, recommendedAction}`) which is
 * translated alongside the title/body so a language change reaches the whole
 * story. The output shape is parsed by {@link parseTranslationBatch} and must
 * stay in sync with the prompt below.
 */

/** The AI-insight text that follows a story into the target language (v1.8.0). */
export interface InsightTranslationText {
	summary: string;
	significance: string;
	impact: string;
	recommendedAction: string;
}

/** One story the translator should translate. */
export interface TranslationBatchItem {
	id: string;
	title: string;
	content: string;
	/** Present when the story has an AI insight — translate it too (v1.8.0). */
	insight?: InsightTranslationText | null;
}

export function buildTranslationPrompt(opts: {
	targetLanguage: string;
	items: TranslationBatchItem[];
}): { system: string; user: string } {
	const system = [
		"You are Vorynth, a professional translator. The user asked to translate",
		"their collected stories so they can read them in their own language.",
		`Translate each story's TITLE and full BODY text faithfully into: ${opts.targetLanguage}.`,
		"- Preserve meaning, tone, and structure. Keep numbers, names, URLs, and code",
		"  identifiers in their original form.",
		"- Technical terms and proper names (library names, CVE IDs, model names, tool",
		"  names, product names) DO get translated into the target language — but on",
		"  their first mention, append the source-language term in parentheses,",
		"  e.g. \u201C\u06A9\u0644\u0627\u0648\u062F\u0641\u0644\u0631 (Cloudflare)\u201D. Use the source term exactly as written.",
		"- Do not add commentary, explanations, or a summary. Do not omit paragraphs.",
		"- When an item ALSO carries an `insight` object (Vorynth's AI analysis of that",
		"  story), translate its `summary`, `significance`, `impact`, and",
		"  `recommendedAction` fields too, keeping exactly those keys. Return the",
		"  `insight` key only when the input item had one.",
		"- Each output object MUST carry the same `id` as its input, in the same order.",
		"",
		`Return ONLY a JSON array with EXACTLY ${opts.items.length} objects — no prose, no markdown code fences:`,
		'[{"id":"<input id>","title":"<translated title>","content":"<translated content>","insight":{"summary":"...","significance":"...","impact":"...","recommendedAction":"..."}}, ...]',
	].join("\n");

	const user = JSON.stringify(
		opts.items.map((i) => ({
			id: i.id,
			title: i.title,
			content: i.content,
			...(i.insight ? { insight: i.insight } : {}),
		})),
	);

	return { system, user };
}

/**
 * A focused prompt that translates ONLY a story's AI insight (v1.8.0).
 *
 * Used as a fallback when the main story-translation pass returns the insight
 * in the WRONG language: on very long articles (15K+ chars of body) the model
 * reliably translates title + body but occasionally returns the insight text
 * unchanged from its previous language. Translating the four short insight
 * fields alone is a much smaller job the model completes faithfully, so we
 * re-ask just for the insight instead of retrying the whole story.
 */
export function buildInsightOnlyPrompt(opts: {
	targetLanguage: string;
	id: string;
	insight: InsightTranslationText;
}): { system: string; user: string } {
	const system = [
		"You are Vorynth, a professional translator.",
		`Translate the following Vorynth AI analysis (an insight about a tech story) into: ${opts.targetLanguage}.`,
		"- Translate every field faithfully. Keep numbers, names, URLs, and code",
		"  identifiers in their original form.",
		"- Technical terms and proper names DO get translated into the target",
		"  language — on first mention append the source-language term in",
		"  parentheses, e.g. \u201C\u06A9\u0644\u0627\u0648\u062F\u0641\u0644\u0631 (Cloudflare)\u201D.",
		"- If a field is already in the target language, return it as-is.",
		"",
		"Return ONLY a JSON object with EXACTLY these keys — no prose, no markdown",
		'code fences: {"summary":"...","significance":"...","impact":"...","recommendedAction":"..."}',
	].join("\n");
	const user = JSON.stringify(opts.insight);
	return { system, user };
}

/** A validated insight translation — the four fields, all strings. */
export interface ParsedInsightTranslation {
	summary: string;
	significance: string;
	impact: string;
	recommendedAction: string;
}

/**
 * Parse a single-object insight translation, tolerating the same quirks as
 * {@link parseTranslationBatch} (code fences, surrounding prose). Returns
 * null when nothing valid parses.
 */
export function parseInsightOnly(raw: string): ParsedInsightTranslation | null {
	let text = raw.trim();
	const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fence && fence[1]) text = fence[1].trim();
	let obj: unknown = parseAsJson(text);
	if (obj === undefined) {
		const match = text.match(/\{[\s\S]*\}/);
		if (!match) return null;
		obj = parseAsJson(match[0]);
	}
	if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
		return null;
	}
	const record = obj as Record<string, unknown>;
	const summary = String(record.summary ?? "").trim();
	const significance = String(record.significance ?? "").trim();
	const impact = String(record.impact ?? "").trim();
	const recommendedAction = String(record.recommendedAction ?? "").trim();
	if (!summary) return null;
	return { summary, significance, impact, recommendedAction };
}

/** A validated translation result — `id` refers to the source article. */
export interface ParsedTranslation {
	id: string;
	title: string;
	content: string;
	/** The translated insight, present when the input carried one (v1.8.0). */
	insight?: InsightTranslationText | null;
}

/**
 * Parse the model's batch JSON response into validated translations.
 *
 * Tolerates the same quirks as the other LLM parsers (stray code fences,
 * leading/trailing prose) and coerces types defensively: entries without a
 * valid id or with an empty title/content are dropped (R-A06 — LLM output is
 * untrusted until validated). An item's `insight` is optional and lenient —
 * a missing or malformed insight only drops that item's insight, never the
 * story's title/body translation. Malformed output degrades to `[]` — the
 * caller treats that as a skipped batch, never a crash.
 */
export function parseTranslationBatch(raw: string): ParsedTranslation[] {
	let text = raw.trim();
	const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fence && fence[1]) text = fence[1].trim();

	let arr = parseAsJson(text);
	if (arr === undefined) {
		const match = text.match(/\[[\s\S]*\]/);
		if (!match) return [];
		arr = parseAsJson(match[0]);
	}
	if (arr === undefined) return [];
	if (!Array.isArray(arr)) return [];
	const out: ParsedTranslation[] = [];
	for (const item of arr) {
		if (typeof item !== "object" || item === null) continue;
		const record = item as Record<string, unknown>;
		const id = String(record.id ?? "").trim();
		const title = String(record.title ?? "").trim();
		const content = String(record.content ?? "").trim();
		if (!id || !title || !content) continue;
		const insightRaw = record.insight;
		const outItem: ParsedTranslation = { id, title, content };
		if (insightRaw && typeof insightRaw === "object") {
			const ins = insightRaw as Record<string, unknown>;
			const summary = String(ins.summary ?? "").trim();
			const significance = String(ins.significance ?? "").trim();
			const impact = String(ins.impact ?? "").trim();
			const recommendedAction = String(ins.recommendedAction ?? "").trim();
			if (summary) {
				outItem.insight = {
					summary,
					significance,
					impact,
					recommendedAction,
				};
			}
		}
		out.push(outItem);
	}
	return out;
}

/**
 * Parse a raw model response as JSON, tolerating the truncation we actually
 * see from Gemini on long outputs (R-A06): the model occasionally closes the
 * outer array with `}` instead of `]` — the last bracket is simply missing
 * (observed on 5K+ char translations of title + full body + insight). The
 * content up to that point is complete, so retry with the still-open brackets
 * closed instead of discarding the whole batch (which silently skipped the
 * story's re-translation). Returns `undefined` when nothing parses.
 */
function parseAsJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		// The outer array's closing bracket is sometimes written as `}` (or
		// dropped entirely) on long outputs. Try closing the still-open
		// brackets with every plausible combination first.
		for (const suffix of ["]", "}]", "]}", "}}]", "}]}", "]]"]) {
			try {
				return JSON.parse(text + suffix);
			} catch {
				/* keep trying */
			}
		}
		// The very last `}` may be a `]` that the model typed wrong — swap it
		// (and retry the appends) before giving up.
		const lastIdx = text.length - 1;
		if (text[lastIdx] === "}") {
			const swapped = text.slice(0, lastIdx) + "]";
			try {
				return JSON.parse(swapped);
			} catch {
				for (const suffix of ["}", "]}", "}}]"]) {
					try {
						return JSON.parse(swapped + suffix);
					} catch {
						/* keep trying */
					}
				}
			}
		}
		return undefined;
	}
}
