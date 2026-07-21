import Database from "better-sqlite3";
import { resolveDbPath } from "./paths.js";
import { DDL, ADDITIVE_DDLS, seedDefaults } from "./ddl.js";
import { FTS_VIRTUAL_DDL, FTS_BACKFILL_SQL } from "./fts-schema.js";
import { normalizeText } from "../search/text-normalizer.js";

/**
 * CLI-only migration entrypoint: `pnpm db:migrate`.
 *
 * Shares its DDL with `database.service.ts` which also calls `runMigrations`
 * on every startup. This script exists as a stand-alone convenience for dev
 * workflows (re-seeding, CI, debugging).
 */
async function main() {
	const filePath = resolveDbPath();
	const db = new Database(filePath);
	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");

	console.log(`▶ Migrating database at ${filePath}`);
	db.exec(DDL);

	// ── FTS5 setup (v1.3.0) ──────────────────────────────────────────
	console.log("▶ Setting up FTS5 full-text search");
	db.function("normalize_fts", (text: unknown) => {
		if (typeof text !== "string" || text.length === 0) return "";
		return normalizeText(text);
	});
	db.exec(FTS_VIRTUAL_DDL);

	const { changes: backfilled } = db.prepare(FTS_BACKFILL_SQL).run();
	if (backfilled > 0) {
		console.log(`• Backfilled ${backfilled} articles into FTS index`);
	}
	// ── end FTS5 ─────────────────────────────────────────────────────

	// Additive column adds — tolerated if the column already exists.
	for (const stmt of ADDITIVE_DDLS) {
		try {
			db.exec(stmt);
		} catch (err) {
			const msg = (err as Error).message.toLowerCase();
			if (!msg.includes("duplicate column")) {
				throw err;
			}
		}
	}

	seedDefaults(db);
	db.close();
	console.log("✓ Migrations complete");
}

main().catch((err) => {
	console.error("✗ Migration failed", err);
	process.exit(1);
});
