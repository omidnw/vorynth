import { Global, Module } from "@nestjs/common";
import { DatabaseService } from "./database.service.js";

/**
 * Global DB module.
 *
 * Owns the single `better-sqlite3` connection. Every feature module injects
 * `DatabaseService` to access Drizzle. Kept as a `@Global()` module so feature
 * modules don't each have to re-import it.
 *
 * Lifecycle logging lives on `DatabaseService` (it owns the handle); a module
 * class doesn't receive injected providers reliably in `OnModuleInit`.
 */
@Global()
@Module({
	providers: [DatabaseService],
	exports: [DatabaseService],
})
export class DbModule {}
