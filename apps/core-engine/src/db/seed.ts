import Database from "better-sqlite3";
import { resolveDbPath } from "./paths.js";
import { seedSources, SEED_SOURCES } from "./ddl.js";

/**
 * `pnpm db:seed` — standalone CLI to insert the default source list.
 *
 * Uses `INSERT OR IGNORE` so existing entries (possibly modified by the user)
 * are left untouched. Sources are also seeded automatically on every startup
 * by `DatabaseService.onModuleInit()` → `seedDefaults()` → `seedSources()`.
 */
async function main() {
	const filePath = resolveDbPath();
	const db = new Database(filePath);
	db.pragma("foreign_keys = ON");

	seedSources(db);
	console.log(`• Seeded ${SEED_SOURCES.length} sources`);

	// Ensure default user profile.
	db.prepare(
		`INSERT INTO user_profile (id) VALUES ('default')
	   ON CONFLICT(id) DO NOTHING`,
	).run();

	db.close();

	const probe = new Database(filePath);
	const n = probe.prepare("SELECT COUNT(*) as c FROM sources").get() as {
		c: number;
	};
	probe.close();
	console.log(`✓ Seed complete — ${n.c} sources in db at ${filePath}`);
}

main().catch((err) => {
	console.error("✗ Seed failed", err);
	process.exit(1);
});
