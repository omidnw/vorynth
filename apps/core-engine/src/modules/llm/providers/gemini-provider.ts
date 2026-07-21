import { Injectable, Logger } from "@nestjs/common";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type {
	AnalyzeInput,
	GenerateInput,
	InsightDraft,
	LlmProvider,
} from "../llm-provider.js";
import { buildAnalyzePrompt } from "../prompts/analyze.prompt.js";
import { parseDraft, splitGeneratePrompt } from "./openai-provider.js";

/**
 * Google Gemini provider.
 *
 * Wraps `@langchain/google-genai`. Same prompt shape as OpenAI so the output
 * structure is identical across providers.
 */
@Injectable()
export class GeminiProvider implements LlmProvider {
	readonly kind = "gemini";
	private readonly logger = new Logger("GeminiProvider");
	private readonly model: ChatGoogleGenerativeAI;

	constructor(opts: { apiKey: string; model?: string }) {
		this.model = new ChatGoogleGenerativeAI({
			apiKey: opts.apiKey,
			model: opts.model ?? "gemini-2.0-flash",
			temperature: 0,
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
