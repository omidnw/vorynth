import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTestDb, type TestDb } from "../helpers/db.js";
import { LlmService } from "../../src/modules/llm/llm.service.js";
import { CryptoService } from "../../src/modules/crypto/crypto.service.js";
import { RateLimiter } from "../../src/modules/llm/rate-limiter.js";
import { UsageService } from "../../src/modules/llm/usage.service.js";
import { HistoryService } from "../../src/modules/history/history.service.js";

/**
 * Structured LLM-unavailable reasons (v1.8.0) — the engine must tell the UI
 * WHY an AI action can't run: nothing configured, a missing key, or a key
 * that can no longer be decrypted. Offline, throwaway DB.
 */

function makeLlm(tdb: TestDb): LlmService {
	const db = tdb.service;
	return new LlmService(
		new ConfigService({}),
		db,
		new CryptoService(),
		new RateLimiter(),
		new UsageService(db),
		new HistoryService(db),
	);
}

function seedProvider(tdb: TestDb, encryptedKey: string | null): void {
	tdb.service.rawDb
		.prepare(
			`INSERT INTO llm_providers (id, kind, label, encrypted_api_key)
			 VALUES (?, 'gemini', 'Test', ?)`,
		)
		.run(`llm-${Math.random().toString(36).slice(2)}`, encryptedKey);
}

function codeOf(err: BadRequestException): string {
	return (err.getResponse() as { code: string }).code;
}

describe("LlmService.unavailableReason / unavailableException (v1.8.0)", () => {
	let tdb: TestDb;
	let llm: LlmService;

	beforeEach(() => {
		tdb = createTestDb();
		llm = makeLlm(tdb);
	});

	afterEach(() => tdb.close());

	it("reports not-configured when there are no providers", () => {
		expect(llm.unavailableReason()).toBe("not-configured");
		const err = llm.unavailableException();
		expect(err).toBeInstanceOf(BadRequestException);
		expect(codeOf(err)).toBe("LLM_NOT_CONFIGURED");
	});

	it("reports key-missing when the only provider has no key stored", () => {
		seedProvider(tdb, null);
		expect(llm.unavailableReason()).toBe("key-missing");
		expect(codeOf(llm.unavailableException())).toBe("LLM_KEY_MISSING");
	});

	it("reports key-undecryptable when the stored key blob can't be decrypted", () => {
		seedProvider(tdb, "not-a-valid-ciphertext");
		expect(llm.unavailableReason()).toBe("key-undecryptable");
		expect(codeOf(llm.unavailableException())).toBe("LLM_KEY_UNDECRYPTABLE");
	});

	it("reports null when a provider is fully usable", () => {
		seedProvider(tdb, new CryptoService().encrypt("secret-key"));
		expect(llm.unavailableReason()).toBeNull();
	});
});
