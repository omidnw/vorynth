import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseService } from "../../src/db/database.service.js";
import { BackupService } from "../../src/modules/backup/backup.service.js";

/**
 * Backup service (v1.8.0) — Settings → Data Ownership.
 *
 * Business rules:
 *   • `list()` reports BOTH backup flavors that live in `data/backups/`:
 *     `.vorynth-backup` engine snapshots and plain `.sqlite` copies — but
 *     never manifests or WAL/SHM sidecars;
 *   • `resolve()` refuses anything outside the backups dir (traversal guard),
 *     non-backup names, and missing files.
 */
describe("backup service", () => {
	const originalDataDir = process.env.VORYNTH_DATA_DIR;

	afterEach(() => {
		if (originalDataDir === undefined) delete process.env.VORYNTH_DATA_DIR;
		else process.env.VORYNTH_DATA_DIR = originalDataDir;
	});

	function makeHarness(): {
		dir: string;
		service: BackupService;
		close(): void;
	} {
		const dir = mkdtempSync(join(tmpdir(), "vorynth-backup-"));
		process.env.VORYNTH_DATA_DIR = dir;
		const db = new DatabaseService(join(dir, "vorynth.sqlite"));
		db.onModuleInit();
		const service = new BackupService(db);
		return { dir, service, close: () => db.close() };
	}

	it("lists both backup flavors, newest first, and skips sidecars", async () => {
		const { dir, service, close } = makeHarness();
		try {
			const backups = join(dir, "backups");
			mkdirSync(backups, { recursive: true });
			const engine = join(backups, "vorynth-2026-01-01.vorynth-backup");
			const sqlite = join(backups, "vorynth-2026-01-02.sqlite");
			writeFileSync(engine, "x");
			writeFileSync(sqlite, "y");
			// Manifests and WAL sidecars must never be listed.
			writeFileSync(
				join(backups, "vorynth-2026-01-01.vorynth-backup.manifest.json"),
				"{}",
			);
			writeFileSync(join(backups, "vorynth-2026-01-02.sqlite-wal"), "w");
			writeFileSync(join(backups, "vorynth-2026-01-02.sqlite-shm"), "s");
			// Deterministic order: the .sqlite copy is the newest.
			utimesSync(
				sqlite,
				new Date("2026-01-02T00:00:00Z"),
				new Date("2026-01-02T00:00:00Z"),
			);
			utimesSync(
				engine,
				new Date("2026-01-01T00:00:00Z"),
				new Date("2026-01-01T00:00:00Z"),
			);

			const list = await service.list();
			expect(list).toHaveLength(2);
			expect(list[0]?.name).toBe("vorynth-2026-01-02.sqlite");
			expect(list[0]?.kind).toBe("sqlite");
			expect(list[1]?.name).toBe("vorynth-2026-01-01.vorynth-backup");
			expect(list[1]?.kind).toBe("vorynth-backup");
			expect(list[0]?.sizeBytes).toBe(1);
			expect(list[0]?.path).toBe(sqlite);
		} finally {
			close();
		}
	});

	it("resolve() returns the in-dir path and refuses traversal, non-backups, and missing files", async () => {
		const { dir, service, close } = makeHarness();
		try {
			const backups = join(dir, "backups");
			mkdirSync(backups, { recursive: true });
			writeFileSync(join(backups, "ok.vorynth-backup"), "z");

			await expect(service.resolve("ok.vorynth-backup")).resolves.toBe(
				join(backups, "ok.vorynth-backup"),
			);
			// Path traversal out of the backups dir.
			await expect(service.resolve("../vorynth.sqlite")).rejects.toThrow(
				"invalid backup name",
			);
			// Non-backup file names.
			await expect(service.resolve("manifest.json")).rejects.toThrow(
				"not a backup file",
			);
			// Missing files.
			await expect(service.resolve("missing.vorynth-backup")).rejects.toThrow(
				"backup file not found",
			);
		} finally {
			close();
		}
	});
});
