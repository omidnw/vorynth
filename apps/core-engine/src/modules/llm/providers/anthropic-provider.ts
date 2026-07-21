import { Injectable, Logger } from "@nestjs/common";
import { ChatAnthropic } from "@langchain/anthropic";
import type {
	AnalyzeInput,
	GenerateInput,
	InsightDraft,
	LlmProvider,
} from "../llm-provider.js";
import { buildAnalyzePrompt } from "../prompts/analyze.prompt.js";
import { parseDraft, splitGeneratePrompt } from "./openai-provider.js";

/**
 * Anthropic (Claude) provider. Wraps `@langchain/anthropic`. Same prompt shape
 * as the other providers.
 */
@Injectable()
export class AnthropicProvider implements LlmProvider {
	readonly kind = "anthropic";
	private readonly logger = new Logger("AnthropicProvider");
	private readonly model: ChatAnthropic;

	constructor(opts: { apiKey: string; model?: string }) {
		this.model = new ChatAnthropic({
			anthropicApiKey: opts.apiKey,
			model: opts.model ?? "claude-3-5-sonnet-latest",
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
