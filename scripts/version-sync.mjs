#!/usr/bin/env node

/**
 * Version sync — single source of truth, zero drift.
 *
 * Reads the version from the ROOT `package.json`, then writes it to every
 * file that needs to carry it. Run this after bumping the version in the
 * root package.json:
 *
 *   pnpm version:sync
 *
 * To **check** without writing (CI use):
 *
 *   pnpm version:check
 *
 * Currently synced targets (all must match `version` in root package.json):
 *
 *   packages/types/src/index.ts         → VORYNTH_VERSION constant
 *   apps/core-engine/package.json       → version field
 *   apps/desktop/package.json           → version field
 *   apps/desktop/src-tauri/tauri.conf.json → version field
 *   apps/desktop/src-tauri/Cargo.toml   → version = "..."
 *
 * If you add a new consumer, register it in the `TARGETS` array below.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── Helpers ───────────────────────────────────────────────────────────────────

function read(rel) {
	return readFileSync(resolve(ROOT, rel), "utf-8");
}

function write(rel, content) {
	writeFileSync(resolve(ROOT, rel), content, "utf-8");
}

function replaceOnce(text, search, replacement, label) {
		// If pattern doesn't match at all, fail hard — the file format changed
		if (!search.test(text)) {
			throw new Error(
				`version-sync: pattern not found in ${label}\n  searched: ${search}`,
			);
		}
		// Pattern matched, so replace. If the new value is the same as the old
		// (e.g. the version is already current), that's fine — no-op, not a bug.
		return text.replace(search, replacement);
	}

// ── Read canonical version ────────────────────────────────────────────────────

const rootPkg = JSON.parse(read("package.json"));
const VERSION = rootPkg.version;

if (!/^\d+\.\d+\.\d+$/.test(VERSION)) {
	console.error(`version-sync: invalid version in root package.json: ${VERSION}`);
	process.exit(1);
}

// ── Targets ───────────────────────────────────────────────────────────────────
// Each entry: { path, read?, patch(label) → void }
//
//   path   — relative to repo root
//   read?  — optional custom reader (default: readFileSync)
//   patch  — mutates content to the new version, returns new content

const TARGETS = [
		{
			path: "packages/types/src/index.ts",
			patch(content) {
				return replaceOnce(
					content,
					/export const VORYNTH_VERSION = "\d+\.\d+\.\d+";/,
					`export const VORYNTH_VERSION = "${VERSION}";`,
					this.path,
				);
			},
		},
		{
			path: "apps/core-engine/package.json",
			patch(content) {
				return replaceOnce(
					content,
					/"version": "\d+\.\d+\.\d+"/,
					`"version": "${VERSION}"`,
					this.path,
				);
			},
		},
		{
			path: "apps/desktop/package.json",
			patch(content) {
				return replaceOnce(
					content,
					/"version": "\d+\.\d+\.\d+"/,
					`"version": "${VERSION}"`,
					this.path,
				);
			},
		},
		{
			path: "apps/desktop/src-tauri/tauri.conf.json",
			patch(content) {
				return replaceOnce(
					content,
					/"version": "\d+\.\d+\.\d+"/,
					`"version": "${VERSION}"`,
					this.path,
				);
			},
		},
	{
		path: "apps/desktop/src-tauri/Cargo.toml",
		patch(content) {
			return replaceOnce(
				content,
				/^version = "\d+\.\d+\.\d+"/m,
				`version = "${VERSION}"`,
				this.path,
			);
		},
	},
];

// ── CLI ───────────────────────────────────────────────────────────────────────

const isCheck = process.argv.includes("--check") || process.argv.includes("--diff");

let anyDiff = false;

for (const t of TARGETS) {
	const current = read(t.path);
	const patched = t.patch(current);

	if (current !== patched) {
		anyDiff = true;
		if (isCheck) {
			console.log(`[diff] ${t.path}`);
		} else {
			write(t.path, patched);
			console.log(`[sync] ${t.path} → ${VERSION}`);
		}
	}
}

if (isCheck) {
	if (anyDiff) {
		console.error(
			`\n❌ Version files are OUT OF SYNC (expected ${VERSION}). Run \`pnpm version:sync\` to fix.`,
		);
		process.exit(1);
	}
	console.log(`✅ All version files match ${VERSION}`);
}
