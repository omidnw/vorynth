import {
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import Database from "better-sqlite3";
import {
	drizzle,
	type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { resolveDbPath } from "./paths.js";
import { normalizeText } from "../search/text-normalizer.js";

/**
 * Wraps the single SQLite connection used by the entire engine.
 *
 * SQLite is the right call here (project-details.md §19): it gives the engine
 * a real local memory layer (sources → articles → knowledge → reports → user
 * history) without asking the user to install or run a database server.
 *
 * `better-sqlite3` is synchronous and fast — Drizzle's better-sqlite3 driver
 * maps directly onto it. The handle is opened once at DI time and closed on
 * module destroy.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger("Db");
	private readonly raw: Database.Database;
	private readonly drizzleInstance: BetterSQLite3Database<typeof schema>;
	readonly filePath: string;

	constructor() {
		this.filePath = resolveDbPath();
		this.raw = new Database(this.filePath);
		this.raw.pragma("journal_mode = WAL");
		this.raw.pragma("foreign_keys = ON");
		this.raw.pragma("busy_timeout = 5000");

		// Register Persian-aware text normalizer as a SQLite function so FTS5
		// triggers can call it transparently when populating the content table.
		// Uses @persian-tools/persian-tools + built-in NFKC normalization.
		this.raw.function("normalize_fts", (text: unknown) => {
			if (typeof text !== "string" || text.length === 0) return "";
			return normalizeText(text);
		});

		this.drizzleInstance = drizzle(this.raw, { schema });
	}

	onModuleInit() {
		this.logger.log(`SQLite opened at ${this.filePath}`);
	}

	onModuleDestroy() {
		this.close();
	}

	get db(): BetterSQLite3Database<typeof schema> {
		return this.drizzleInstance;
	}

	/** Raw better-sqlite3 handle, for migrations and pragma work. */
	get rawDb(): Database.Database {
		return this.raw;
	}

	close(): void {
		try {
			this.raw.close();
		} catch {
			// ignore double-close during shutdown
		}
	}
}
