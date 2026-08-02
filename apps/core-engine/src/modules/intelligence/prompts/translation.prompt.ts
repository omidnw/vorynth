/**
 * Story-translation prompt + batch parser — used by
 * `IntelligenceService.translateAllStories()`.
 *
 * Translate Stories sends several stories per LLM call (5 by default) and
 * asks for a JSON array back — one `{id, title, content}` object per input,
 * keyed by article id so a mis-ordered or partial response still applies
 * safely. The output shape is parsed by {@link parseTranslationBatch} and must
 * stay in sync with the prompt below.
 */

/** One story the translator should translate. */
export interface TranslationBatchItem {
	id: string;
	title: string;
	content: string;
}

export function buildTranslationPrompt(opts: {
	targetLanguage: string;
	items: TranslationBatchItem[];
}): { system: string; user: string } {
	const system = [
		"You are Vorynth, a professional translator. The user asked to translate",
		"their collected stories so they can read them in their own language.",
		`Translate each story's TITLE and full BODY text faithfully into: ${opts.targetLanguage}.`,
		"- Preserve meaning, tone, and structure. Keep numbers, names, URLs, code identifiers,",
		"  and technical terms (library names, CVE IDs, model names) in their original form.",
		"- Do not add commentary, explanations, or a summary. Do not omit paragraphs.",
		"- Each output object MUST carry the same `id` as its input, in the same order.",
		"",
		`Return ONLY a JSON array with EXACTLY ${opts.items.length} objects — no prose, no markdown code fences:`,
		'[{"id":"<input id>","title":"<translated title>","content":"<translated content>"}, ...]',
	].join("\n");

	const user = JSON.stringify(
		opts.items.map((i) => ({ id: i.id, title: i.title, content: i.content })),
	);

	return { system, user };
}

/** A validated translation result — `id` refers to the source article. */
export interface ParsedTranslation {
	id: string;
	title: string;
	content: string;
}

/**
 * Parse the model's batch JSON response into validated translations.
 *
 * Tolerates the same quirks as the other LLM parsers (stray code fences,
 * leading/trailing prose) and coerces types defensively: entries without a
 * valid id or with an empty title/content are dropped (R-A06 — LLM output is
 * untrusted until validated). Malformed output degrades to `[]` — the caller
 * treats that as a skipped batch, never a crash.
 */
export function parseTranslationBatch(raw: string): ParsedTranslation[] {
	let text = raw.trim();
	const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fence && fence[1]) text = fence[1].trim();

	let arr: unknown;
	try {
		arr = JSON.parse(text);
	} catch {
		const match = text.match(/\[[\s\S]*\]/);
		if (!match) return [];
		try {
			arr = JSON.parse(match[0]);
		} catch {
			return [];
		}
	}

	if (!Array.isArray(arr)) return [];
	const out: ParsedTranslation[] = [];
	for (const item of arr) {
		if (typeof item !== "object" || item === null) continue;
		const record = item as Record<string, unknown>;
		const id = String(record.id ?? "").trim();
		const title = String(record.title ?? "").trim();
		const content = String(record.content ?? "").trim();
		if (!id || !title || !content) continue;
		out.push({ id, title, content });
	}
	return out;
}
