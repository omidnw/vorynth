import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
	existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { strFromU8, unzipSync } from "fflate";

/**
 * .vorynth-plugin package builder (v1.8.0) — end-to-end CLI test. Builds a
 * plugin folder, runs scripts/package-plugin.mjs, and asserts the output is a
 * zip the engine's `installPackage` can consume (plugin.json + bundle.js).
 *
 * Vitest serves test modules over a dev-server URL, so the script path is
 * resolved from the working directory (the desktop package) instead of
 * `import.meta.url`.
 */
const SCRIPT = resolve(process.cwd(), "scripts", "package-plugin.mjs");

describe("package-plugin.mjs — .vorynth-plugin package builder", () => {
	it("zips a plugin folder (manifest + bundle) into a package", () => {
		const dir = mkdtempSync(join(tmpdir(), "vorynth-pkg-"));
		try {
			mkdirSync(join(dir, "my-plugin"));
			writeFileSync(
				join(dir, "my-plugin", "plugin.json"),
				JSON.stringify({
					id: "my-plugin",
					name: "My Plugin",
					version: "1.0.0",
					contributions: ["theme"],
				}),
			);
			writeFileSync(join(dir, "my-plugin", "bundle.js"), "export default {};");
			// Extra asset ships alongside the code.
			mkdirSync(join(dir, "my-plugin", "assets"));
			writeFileSync(join(dir, "my-plugin", "assets", "badge.svg"), "<svg/>");
			const out = join(dir, "my-plugin.vorynth-plugin");

			execFileSync(process.execPath, [
				SCRIPT,
				join(dir, "my-plugin"),
				"-o",
				out,
			]);
			expect(existsSync(out)).toBe(true);

			const entries = unzipSync(new Uint8Array(readFileSync(out)));
			expect(entries["plugin.json"]).toBeDefined();
			expect(entries["bundle.js"]).toBeDefined();
			const manifest = JSON.parse(strFromU8(entries["plugin.json"]!));
			expect(manifest).toMatchObject({
				id: "my-plugin",
				name: "My Plugin",
				version: "1.0.0",
			});
			expect(strFromU8(entries["bundle.js"]!)).toBe("export default {};");
			expect(strFromU8(entries["assets/badge.svg"]!)).toBe("<svg/>");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("fails fast when the folder has no bundle.js", () => {
		const dir = mkdtempSync(join(tmpdir(), "vorynth-pkg-"));
		try {
			mkdirSync(join(dir, "bare"));
			writeFileSync(
				join(dir, "bare", "plugin.json"),
				JSON.stringify({ id: "bare", name: "B", version: "1.0.0" }),
			);
			expect(() =>
				execFileSync(process.execPath, [SCRIPT, join(dir, "bare")], {
					stdio: "pipe",
				}),
			).toThrow(/bundle\.js/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("fails fast when the manifest is incomplete", () => {
		const dir = mkdtempSync(join(tmpdir(), "vorynth-pkg-"));
		try {
			mkdirSync(join(dir, "broken"));
			writeFileSync(
				join(dir, "broken", "plugin.json"),
				JSON.stringify({ id: "broken", name: "B" }), // no version
			);
			writeFileSync(join(dir, "broken", "bundle.js"), "export {};");
			expect(() =>
				execFileSync(process.execPath, [SCRIPT, join(dir, "broken")], {
					stdio: "pipe",
				}),
			).toThrow(/id, name, and version/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
