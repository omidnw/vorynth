import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CryptoService } from "../../src/modules/crypto/crypto.service.js";

/**
 * At-rest key encryption (project-details.md §32.2). These tests prove the
 * primitives behind the Settings "key can't be decrypted" state: an encrypted
 * blob round-trips, tampered blobs are rejected, and a blob encrypted under
 * one master salt (one data dir) is unreadable with another — exactly what
 * happens when `.vorynth-master` is lost in a restore or data-dir cleanup.
 */

/** Point VORYNTH_DATA_DIR at a throwaway temp dir; returns a restore fn. */
function withTempDataDir(): () => void {
	const dir = mkdtempSync(join(tmpdir(), "vorynth-crypto-test-"));
	const prev = process.env.VORYNTH_DATA_DIR;
	process.env.VORYNTH_DATA_DIR = dir;
	return () => {
		if (prev === undefined) delete process.env.VORYNTH_DATA_DIR;
		else process.env.VORYNTH_DATA_DIR = prev;
	};
}

describe("CryptoService", () => {
	it("round-trips a secret through encrypt/decrypt", () => {
		const restore = withTempDataDir();
		try {
			const crypto = new CryptoService();
			const blob = crypto.encrypt("AIza-test-key-123");
			// The plaintext must never leak into the stored blob.
			expect(blob).not.toContain("AIza");
			expect(crypto.decrypt(blob)).toBe("AIza-test-key-123");
		} finally {
			restore();
		}
	});

	it("rejects a tampered blob", () => {
		const restore = withTempDataDir();
		try {
			const crypto = new CryptoService();
			const blob = Buffer.from(crypto.encrypt("secret"), "base64");
			blob[blob.length - 8] ^= 0xff; // flip a byte in the auth tag
			expect(() => crypto.decrypt(blob.toString("base64"))).toThrow();
		} finally {
			restore();
		}
	});

	it("cannot decrypt a blob encrypted under a different master salt (lost-salt scenario)", () => {
		const restore1 = withTempDataDir();
		let blob: string;
		try {
			blob = new CryptoService().encrypt("secret");
		} finally {
			restore1();
		}
		const restore2 = withTempDataDir();
		try {
			const other = new CryptoService();
			expect(() => other.decrypt(blob)).toThrow();
		} finally {
			restore2();
		}
	});
});
