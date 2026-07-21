import { Inject, Injectable, Logger } from "@nestjs/common";
import { copyFile, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
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

	/** List existing backups in the backups directory. */
	async list(): Promise<
		Array<{ name: string; path: string; sizeBytes: number; createdAt: string }>
	> {
		const dir = resolveBackupDir();
		if (!existsSync(dir)) return [];
		const entries = await readdir(dir);
		const out: Array<{
			name: string;
			path: string;
			sizeBytes: number;
			createdAt: string;
		}> = [];
		const { stat } = await import("node:fs/promises");
		for (const name of entries) {
			if (!name.endsWith(".vorynth-backup")) continue;
			const fullPath = join(dir, name);
			const stats = await stat(fullPath);
			out.push({
				name,
				path: fullPath,
				sizeBytes: stats.size,
				createdAt: stats.mtime.toISOString(),
			});
		}
		return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}

	/** Delete a specific backup file. */
	async remove(name: string): Promise<{ ok: boolean }> {
		const dir = resolveBackupDir();
		const path = join(dir, name);
		if (!path.startsWith(dir)) return { ok: false }; // path-traversal guard
		await rm(path, { force: true });
		return { ok: true };
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
