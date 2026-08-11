import { Injectable, Logger } from "@nestjs/common";
import { ChatOpenAI } from "@langchain/openai";
import type {
	AnalyzeInput,
	GenerateInput,
	InsightDraft,
	LlmProvider,
} from "../llm-provider.js";
import { buildAnalyzePrompt } from "../prompts/analyze.prompt.js";

/**
 * OpenAI provider (project-details.md §24).
 *
 * The vertical slice wires ONE provider (OpenAI) behind the `LlmProvider`
 * abstraction; Gemini / Anthropic / Ollama follow the same shape in Phase 6.
 * The model is configured at construction; the API key is read from env (in
 * the packaged app it's decrypted from the local vault).
 */
@Injectable()
export class OpenAiProvider implements LlmProvider {
	readonly kind = "openai";
	private readonly logger = new Logger("OpenAiProvider");
	private readonly model: ChatOpenAI;

	constructor(opts: { apiKey: string; model?: string; baseUrl?: string }) {
		this.model = new ChatOpenAI({
			openAIApiKey: opts.apiKey,
			modelName: opts.model ?? "gpt-4o-mini",
			temperature: 0,
			configuration: opts.baseUrl ? { baseURL: opts.baseUrl } : undefined,
		});
	}

	async verify(): Promise<boolean> {
		try {
			const res = await this.model.invoke("ping");
			return Boolean(res);
		} catch (err) {
			this.logger.warn(`verify failed: ${(err as Error).message}`);
			return false;
		}
	}

	async analyze(input: AnalyzeInput): Promise<InsightDraft> {
		const { system, user } = buildAnalyzePrompt(input);
		const res = await this.model.invoke([
			{ role: "system", content: system },
			{ role: "user", content: user },
		]);
		const text =
			typeof res.content === "string" ? res.content : String(res.content);
		return parseDraft(text);
	}

	async generate(input: GenerateInput): Promise<string> {
		const { system, user } = splitGeneratePrompt(input);
		const res = await this.model.invoke([
			{ role: "system", content: system },
			{ role: "user", content: user },
		]);
		return typeof res.content === "string" ? res.content : String(res.content);
	}
}

/** Parse the model's JSON response, tolerating stray code fences. */
export function parseDraft(raw: string): InsightDraft {
	let text = raw.trim();
	const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fence && fence[1]) text = fence[1].trim();

	let obj: Partial<InsightDraft>;
	try {
		obj = JSON.parse(text);
	} catch {
		// Last-ditch: try to find the first {...} block.
		const match = text.match(/\{[\s\S]*\}/);
		if (!match) {
			return {
				summary: raw.slice(0, 200),
				significance: "",
				impact: "",
				recommendedAction: "",
				importanceScore: 0,
				category: "other",
				originalSummary: "",
				originalSignificance: "",
				originalImpact: "",
				originalRecommendedAction: "",
			};
		}
		obj = JSON.parse(match[0]);
	}

	const score = Number(obj.importanceScore ?? 0);
	return {
		summary: String(obj.summary ?? ""),
		significance: String(obj.significance ?? ""),
		impact: String(obj.impact ?? ""),
		recommendedAction: String(obj.recommendedAction ?? ""),
		importanceScore: Number.isFinite(score)
			? Math.max(0, Math.min(10, score))
			: 0,
		category: String(obj.category ?? "other"),
		// v1.8.1 — auto-detect mode (untagged sources): the model reports the
		// article's source language so the engine can tell a real bilingual
		// insight from a same-language reword.
		sourceLanguage:
			typeof obj.sourceLanguage === "string" && obj.sourceLanguage.trim()
				? obj.sourceLanguage.trim().toLowerCase()
				: undefined,
		// v1.8.0 — bilingual generation: the source-language version, when the
		// model returned one.
		originalSummary: String(obj.originalSummary ?? ""),
		originalSignificance: String(obj.originalSignificance ?? ""),
		originalImpact: String(obj.originalImpact ?? ""),
		originalRecommendedAction: String(obj.originalRecommendedAction ?? ""),
	};
}

/**
 * Split a {@link GenerateInput} into the two chat messages every provider
 * expects. The user's custom instruction (when present) is folded into the
 * system message so it shapes tone and framing without leaking into the user
 * turn. Output-language is asserted up front so models that ignore late
 * instructions still comply.
 */
export function splitGeneratePrompt(input: GenerateInput): {
	system: string;
	user: string;
} {
	const langLine = `Write your response in ${input.outputLanguage}.`;
	const instructionLine = input.customInstruction
		? `\n\nThe reader's personal directive (honor tone, depth, and preferences): ${input.customInstruction}`
		: "";
	return {
		system: `${input.system}\n\n${langLine}${instructionLine}`,
		user: input.user,
	};
}
