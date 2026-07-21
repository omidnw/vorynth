import { Injectable, Logger } from "@nestjs/common";
import { ChatOpenAI } from "@langchain/openai";
import type {
	AnalyzeInput,
	GenerateInput,
	InsightDraft,
	LlmProvider,
} from "../llm-provider.js";
import { buildAnalyzePrompt } from "../prompts/analyze.prompt.js";
import { parseDraft, splitGeneratePrompt } from "./openai-provider.js";

/**
 * Ollama (local models) provider.
 *
 * Ollama exposes an OpenAI-compatible endpoint, so we reuse `ChatOpenAI`
 * pointed at the local server (default http://localhost:11434/v1). No API key
 * is needed for local inference — the engine accepts any non-empty string.
 */
@Injectable()
export class OllamaProvider implements LlmProvider {
	readonly kind = "ollama";
	private readonly logger = new Logger("OllamaProvider");
	private readonly model: ChatOpenAI;

	constructor(opts: { baseUrl?: string; model?: string }) {
		this.model = new ChatOpenAI({
			openAIApiKey: "ollama", // required by the client but ignored by the server
			modelName: opts.model ?? "llama3.2",
			temperature: 0,
			configuration: {
				baseURL: opts.baseUrl ?? "http://localhost:11434/v1",
			},
		});
	}

	async verify(): Promise<boolean> {
		try {
			const res = await this.model.invoke("ping");
			return Boolean(res);
		} catch (err) {
			this.logger.warn(
				`verify failed (is Ollama running?): ${(err as Error).message}`,
			);
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
