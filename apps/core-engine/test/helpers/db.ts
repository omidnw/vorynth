import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseService } from "../../src/db/database.service.js";

export interface TestDb {
	service: DatabaseService;
	/** Temp data dir the DB lives in (removed by the OS, not by us). */
	dir: string;
	close(): void;
}

/**
 * Create a throwaway SQLite database with all migrations applied.
 *
 * Uses a fresh temp directory per call so tests never touch the real
 * `VORYNTH_DATA_DIR` / `<cwd>/data` database and never share state. The
 * `DatabaseService` constructor accepts an explicit path (used only here);
 * NestJS DI still constructs it with no args in production.
 */
export function createTestDb(): TestDb {
	const dir = mkdtempSync(join(tmpdir(), "vorynth-test-"));
	const service = new DatabaseService(join(dir, "test.sqlite"));
	service.onModuleInit(); // runs runMigrations() + seedDefaults()
	return {
		service,
		dir,
		close: () => service.close(),
	};
}
