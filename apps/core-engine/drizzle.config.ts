import { defineConfig } from "drizzle-kit";
import { resolveDbPath } from "./src/db/paths.js";

/**
 * Drizzle Kit config for `pnpm db:generate` / `pnpm db:studio`.
 *
 * Programmatic migrations for the slice run via `src/db/migrate.ts`; Drizzle
 * Kit takes over for versioned SQL migrations once we harden in Phase 6.
 */
export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
	dbCredentials: {
		url: resolveDbPath(),
	},
	verbose: true,
	strict: true,
});
