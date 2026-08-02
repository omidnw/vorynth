import Database from "better-sqlite3";
import { resolveDbPath } from "./paths.js";
import { runMigrations } from "./ddl.js";

/**
 * CLI-only migration entrypoint: `pnpm db:migrate`.
 *
 * Delegates to the same `runMigrations` the server calls on startup
 * (database.service.ts) — tables, FTS5, additive ALTERs, spine backfill, seed
 * defaults — so the CLI and the server can never drift. This script exists as
 * a stand-alone convenience for dev workflows (re-seeding, CI, debugging).
 */
async function main() {
	const filePath = resolveDbPath();
	const db = new Database(filePath);
	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");

	console.log(`▶ Migrating database at ${filePath}`);
	runMigrations(db);
	db.close();
	console.log("✓ Migrations complete");
}

main().catch((err) => {
	console.error("✗ Migration failed", err);
	process.exit(1);
});
