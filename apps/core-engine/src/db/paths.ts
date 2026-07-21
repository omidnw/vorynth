import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { cwd } from "node:process";

/**
 * Resolves the directory where Vorynth stores local-first data (SQLite db,
 * generated reports, encrypted API keys, backups).
 *
 * Priority:
 *   1. `VORYNTH_DATA_DIR` env var (dev: `./data`, prod: set by Tauri to the
 *      platform app-data dir).
 *   2. `<cwd>/data` fallback.
 *
 * The directory is created on demand. Per project-details.md §32 the user owns
 * this directory and can export/delete it at will.
 */
export function resolveDataDir(env: NodeJS.ProcessEnv = process.env): string {
	const explicit = env.VORYNTH_DATA_DIR?.trim();
	const dir =
		explicit && explicit.length > 0 ? resolve(explicit) : join(cwd(), "data");
	mkdirSync(dir, { recursive: true });
	return dir;
}

export function resolveDbPath(env: NodeJS.ProcessEnv = process.env): string {
	return join(resolveDataDir(env), "vorynth.sqlite");
}

export function resolveBackupDir(env: NodeJS.ProcessEnv = process.env): string {
	const dir = join(resolveDataDir(env), "backups");
	mkdirSync(dir, { recursive: true });
	return dir;
}

/**
 * Media storage dir — bytes for article media the user has opted to keep
 * locally. Sits under the data dir so it travels with backups and is fully
 * user-owned (deleting this folder = "release all local media"). One
 * subdirectory per article id keeps cleanup simple on article delete.
 */
export function resolveMediaDir(env: NodeJS.ProcessEnv = process.env): string {
	const dir = join(resolveDataDir(env), "vorynth-media");
	mkdirSync(dir, { recursive: true });
	return dir;
}

/** Per-article media dir (created lazily by the media service). */
export function resolveArticleMediaDir(
	articleId: string,
	env: NodeJS.ProcessEnv = process.env,
): string {
	return join(resolveMediaDir(env), articleId);
}

export function resolveDirFor(
	file: string,
	_env: NodeJS.ProcessEnv = process.env,
): string {
	const dir = dirname(file);
	mkdirSync(dir, { recursive: true });
	return dir;
}
