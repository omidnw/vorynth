import { Injectable, Logger } from "@nestjs/common";
import type {
	AnalyzeInput,
	GenerateInput,
	InsightDraft,
	LlmProvider,
} from "../llm-provider.js";
import { buildAnalyzePrompt } from "../prompts/analyze.prompt.js";
import { parseDraft, splitGeneratePrompt } from "./openai-provider.js";

interface OllamaChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

interface OllamaChatResponse {
	message?: { content?: string };
}

/**
 * Ollama provider — LOCAL and CLOUD (v1.8.1).
 *
 * Ollama has two modes (docs.ollama.com/cloud):
 * - local: your own Ollama server (`http://localhost:11434`), no API key.
 * - cloud: Ollama's hosted service (`https://ollama.com`) — big models without
 *   a local GPU. Requires an API key from ollama.com/settings/keys, sent as an
 *   `Authorization: Bearer` header.
 *
 * Both modes speak the SAME native protocol (`POST /api/chat`, non-streaming),
 * which is what this provider calls directly — no dependency needed. An
 * apiKey is optional: local inference sends none, cloud sends the bearer.
 *
 * Note: the LangChain integration (`@langchain/ollama`) is deliberately NOT
 * used here — the project's pnpm supply-chain policy (trustPolicy:
 * no-downgrade in pnpm-workspace.yaml) blocks adding it on chokidar@4.0.3, a
 * workspace-wide transitive dep. The native protocol is fully documented, so
 * the direct call is verified and dependency-free.
 */
@Injectable()
export class OllamaProvider implements LlmProvider {
	readonly kind = "ollama";
	private readonly logger = new Logger("OllamaProvider");
	private readonly baseUrl: string;
	private readonly model: string;
	private readonly apiKey?: string;

	constructor(opts: { baseUrl?: string; model?: string; apiKey?: string }) {
		this.baseUrl = normalizeOllamaBaseUrl(opts.baseUrl);
		this.model = opts.model ?? "llama3.2";
		this.apiKey = opts.apiKey;
	}

	/** One non-streaming `/api/chat` round trip (native Ollama protocol). */
	private async chat(messages: OllamaChatMessage[]): Promise<string> {
		const res = await fetch(`${this.baseUrl}/api/chat`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				// Cloud auth — a bearer header; local servers ignore it entirely.
				...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
			},
			body: JSON.stringify({ model: this.model, messages, stream: false }),
			signal: AbortSignal.timeout(60_000),
		});
		if (!res.ok) {
			const body = await res.text().catch(() => "");
			throw new Error(`Ollama ${res.status}: ${body.slice(0, 300)}`);
		}
		const data = (await res.json()) as OllamaChatResponse;
		const text = data.message?.content ?? "";
		if (!text) throw new Error("Ollama returned an empty response");
		return text;
	}

	async verify(): Promise<boolean> {
		try {
			const res = await this.chat([{ role: "user", content: "ping" }]);
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
		return parseDraft(
			await this.chat([
				{ role: "system", content: system },
				{ role: "user", content: user },
			]),
		);
	}

	async generate(input: GenerateInput): Promise<string> {
		const { system, user } = splitGeneratePrompt(input);
		return this.chat([
			{ role: "system", content: system },
			{ role: "user", content: user },
		]);
	}
}

/**
 * The native `/api/chat` endpoint is relative to the server ROOT — not the
 * OpenAI-style `/v1` path. Older Vorynth versions stored
 * `http://localhost:11434/v1` (ChatOpenAI compatibility); strip that suffix
 * (and any trailing slash) so stored rows keep working, defaulting to local.
 */
export function normalizeOllamaBaseUrl(baseUrl?: string): string {
	const trimmed = (baseUrl ?? "").trim();
	if (!trimmed) return "http://localhost:11434";
	return trimmed.replace(/\/v1\/?$/, "").replace(/\/+$/, "");
}
