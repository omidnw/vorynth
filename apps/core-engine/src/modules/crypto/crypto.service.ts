import { Injectable } from "@nestjs/common";
import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
	scryptSync,
} from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { hostname, userInfo } from "node:os";
import { resolveDataDir } from "../../db/paths.js";

/**
 * At-rest crypto for API keys (project-details.md §32.2: "API keys are stored
 * locally. Vorynth does not collect or store user credentials").
 *
 * Scheme: AES-256-GCM. The key is derived (scrypt) from a machine-bound salt +
 * a local master file dropped under the data dir. The result is that a key
 * blob copied off this machine cannot be decrypted elsewhere — good enough for
 * a local-first desktop app without asking the user for a passphrase.
 *
 * The master file is generated once, never leaves the device, and lives next
 * to the SQLite db the user already owns (and can wipe via Settings → Delete).
 */
@Injectable()
export class CryptoService {
	private readonly masterKey: Buffer;

	constructor() {
		this.masterKey = this.loadOrCreateMasterKey();
	}

	/** Encrypt a UTF-8 string into a self-contained `iv:ct:tag` blob (base64). */
	encrypt(plaintext: string): string {
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", this.masterKey, iv);
		const ct = Buffer.concat([
			cipher.update(plaintext, "utf8"),
			cipher.final(),
		]);
		const tag = cipher.getAuthTag();
		return Buffer.concat([iv, ct, tag]).toString("base64");
	}

	/** Decrypt a blob produced by {@link encrypt}. Throws on tampering/wrong key. */
	decrypt(blob: string): string {
		const buf = Buffer.from(blob, "base64");
		const iv = buf.subarray(0, 12);
		const tag = buf.subarray(buf.length - 16);
		const ct = buf.subarray(12, buf.length - 16);
		const decipher = createDecipheriv("aes-256-gcm", this.masterKey, iv);
		decipher.setAuthTag(tag);
		return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
			"utf8",
		);
	}

	// ── master key derivation ─────────────────────────────────────────────────

	private loadOrCreateMasterKey(): Buffer {
		const dir = resolveDataDir();
		const masterPath = join(dir, ".vorynth-master");
		const machineBinding = this.machineBinding();

		if (existsSync(masterPath)) {
			const salt = readFileSync(masterPath);
			return scryptSync(machineBinding, salt, 32);
		}

		// First run: generate a random salt and persist it.
		mkdirSync(dir, { recursive: true });
		const salt = randomBytes(32);
		writeFileSync(masterPath, salt, { mode: 0o600 });
		return scryptSync(machineBinding, salt, 32);
	}

	/**
	 * Machine-bound binding material. Combines a per-install salt path with
	 * stable OS identifiers so the derived key only works on this machine.
	 */
	private machineBinding(): string {
		const user = safeUserInfo();
		return createHash("sha256")
			.update("vorynth:v1")
			.update(hostname())
			.update(user)
			.update(process.platform)
			.digest("hex");
	}
}

function safeUserInfo(): string {
	try {
		return userInfo().username ?? "anonymous";
	} catch {
		return "anonymous";
	}
}
