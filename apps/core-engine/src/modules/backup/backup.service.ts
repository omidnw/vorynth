import { Inject, Injectable, Logger } from "@nestjs/common";
import { copyFile, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { DatabaseService } from "../../db/database.service.js";
import { resolveBackupDir, resolveDbPath } from "../../db/paths.js";

/**
 * Backup / restore / delete-all (project-details.md §32.3 – §32.5).
 *
 *   export() → writes a `.vorynth-backup` file containing the SQLite DB +
 *              a small manifest, returns the path.
 *   restore(path) → overwrites the current DB from a backup file.
 *   deleteAll() → wipes the local DB + cached articles so the user starts fresh.
 *
 * Backups live under the data dir's `backups/` folder. The user owns them and
 * can copy them off-device, share them, or import them on another machine.
 */
/**
 * A backup name is a FLAT filename (`/` and `\` never appear) with a known
 * extension, and its resolved path must stay exactly inside the backups dir
 * (a naive `startsWith(dir)` prefix check would let a sibling like
 * `backups2/x.sqlite` through). Backups are created flat, so any separator
 * or unknown extension is always invalid.
 */
function assertSafeBackupName(name: string, dir: string): string {
	if (!name || name.includes("/") || name.includes("\\")) {
		throw new Error(`invalid backup name: ${name}`);
	}
	if (!name.endsWith(".vorynth-backup") && !name.endsWith(".sqlite")) {
		throw new Error(`not a backup file: ${name}`);
	}
	const fullPath = join(dir, name);
	if (!fullPath.startsWith(resolve(dir) + sep)) {
		throw new Error(`invalid backup name: ${name}`);
	}
	return fullPath;
}

@Injectable()
export class BackupService {
	private readonly logger = new Logger("Backup");

	constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

	/** Produce a `.vorynth-backup` archive (SQLite copy + manifest JSON). */
	async export(): Promise<{
		path: string;
		sizeBytes: number;
		createdAt: string;
	}> {
		const dir = resolveBackupDir();
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const fileName = `vorynth-${stamp}.vorynth-backup`;
		const backupPath = join(dir, fileName);

		// better-sqlite3's `backup` API does a safe online copy of the live DB.
		const sourcePath = this.db.filePath;
		await new Promise<void>((resolve, reject) => {
			this.db.rawDb
				.backup(backupPath)
				.then(() => resolve())
				.catch((err: unknown) => reject(err));
		});

		// Append a manifest alongside for human inspection.
		const manifest = {
			version: "1.1.0",
			createdAt: stamp,
			source: sourcePath,
			engine: "vorynth-core-engine",
		};
		const { writeFile } = await import("node:fs/promises");
		await writeFile(
			join(dir, `${fileName}.manifest.json`),
			JSON.stringify(manifest, null, 2),
		);

		const { stat } = await import("node:fs/promises");
		const stats = await stat(backupPath);
		this.logger.log(`exported backup → ${backupPath} (${stats.size} bytes)`);
		return {
			path: backupPath,
			sizeBytes: stats.size,
			createdAt: stamp,
		};
	}

	/**
	 * Restore from a `.vorynth-backup` file. Overwrites the current DB.
	 * The caller is responsible for restarting the engine afterwards (Drizzle
	 * needs to re-read the schema).
	 */
	async restore(backupPath: string): Promise<{ ok: boolean; message: string }> {
		if (!existsSync(backupPath)) {
			return { ok: false, message: `backup file not found: ${backupPath}` };
		}
		const target = resolveDbPath();
		try {
			// Close the live connection, swap files, reopen.
			this.db.close();
			await rm(target, { force: true });
			await copyFile(backupPath, target);
			this.logger.log(`restored backup from ${backupPath} → ${target}`);
			return {
				ok: true,
				message: "Restored. Restart the engine for changes to take effect.",
			};
		} catch (err) {
			return {
				ok: false,
				message: `restore failed: ${(err as Error).message}`,
			};
		}
	}

	/** List existing backups in the backups directory.
	 *
	 * Shows BOTH backup flavors that live in `data/backups/`:
	 *   • `.vorynth-backup` — engine snapshots (Settings → Export),
	 *   • `.sqlite` — plain DB copies (e.g. the agent backup skill).
	 * Manifests and WAL/SHM sidecars are never listed (v1.8.0). */
	async list(): Promise<
		Array<{
			name: string;
			path: string;
			sizeBytes: number;
			createdAt: string;
			kind: "vorynth-backup" | "sqlite";
		}>
	> {
		const dir = resolveBackupDir();
		if (!existsSync(dir)) return [];
		const entries = await readdir(dir);
		const out: Array<{
			name: string;
			path: string;
			sizeBytes: number;
			createdAt: string;
			kind: "vorynth-backup" | "sqlite";
		}> = [];
		const { stat } = await import("node:fs/promises");
		for (const name of entries) {
			const isVorynth = name.endsWith(".vorynth-backup");
			const isSqlite = name.endsWith(".sqlite");
			if (!isVorynth && !isSqlite) continue;
			const fullPath = join(dir, name);
			const stats = await stat(fullPath);
			out.push({
				name,
				path: fullPath,
				sizeBytes: stats.size,
				createdAt: stats.mtime.toISOString(),
				kind: isVorynth ? "vorynth-backup" : "sqlite",
			});
		}
		return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}

	/** Resolve a backup name to its full path.
	 *
	 * Refuses anything outside the backups directory (path-traversal guard)
	 * and names that are not backup files. Throws when the file is missing. */
	async resolve(name: string): Promise<string> {
		const dir = resolveBackupDir();
		const fullPath = assertSafeBackupName(name, dir);
		if (!existsSync(fullPath)) {
			throw new Error(`backup file not found: ${name}`);
		}
		return fullPath;
	}

	/** Delete a specific backup file. */
	async remove(name: string): Promise<{ ok: boolean }> {
		const dir = resolveBackupDir();
		try {
			await rm(assertSafeBackupName(name, dir), { force: true });
			return { ok: true };
		} catch {
			return { ok: false }; // path-traversal guard / not a backup file
		}
	}

	/**
	 * Permanently delete ALL local data (§32.5): the SQLite DB + cached files.
	 * The DB is recreated empty on next engine restart.
	 */
	async deleteAll(): Promise<{ ok: boolean; message: string }> {
		try {
			this.db.close();
			const target = resolveDbPath();
			await rm(target, { force: true });
			// Also wipe the WAL/SHM sidecars.
			await rm(`${target}-wal`, { force: true });
			await rm(`${target}-shm`, { force: true });
			this.logger.warn(
				"ALL LOCAL DATA DELETED — DB recreated empty on next start",
			);
			return {
				ok: true,
				message:
					"All data deleted. Restart the engine to recreate an empty DB.",
			};
		} catch (err) {
			return { ok: false, message: `delete failed: ${(err as Error).message}` };
		}
	}
}
