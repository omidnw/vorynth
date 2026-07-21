import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../db/database.service.js";
import { sources } from "../../db/schema.js";
import { ftsRebuildIndex } from "../../db/fts-sync.js";
import type {
	CreateSourceInput,
	Source,
	UpdateSourceInput,
} from "@vorynth/types";

@Injectable()
export class SourcesService {
	constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

	async list(): Promise<Source[]> {
		const rows = await this.db.db.select().from(sources);
		return rows.map(toDto);
	}

	async get(id: string): Promise<Source> {
		const [row] = await this.db.db
			.select()
			.from(sources)
			.where(eq(sources.id, id))
			.limit(1);
		if (!row) throw new NotFoundException(`source ${id} not found`);
		return toDto(row);
	}

	async create(input: CreateSourceInput): Promise<Source> {
		const id = input.url
			? slugify(input.name) + "-" + randomUUID().slice(0, 8)
			: randomUUID();
		const row = {
			id,
			name: input.name,
			url: input.url,
			type: input.type,
			category: input.category,
			adapter: input.adapter ?? defaultAdapterFor(input.type),
			configuration: (input.configuration ?? {}) as Record<string, unknown>,
			enabled: input.enabled ?? true,
			fetchWindowDays: input.fetchWindowDays ?? 7,
		};
		await this.db.db.insert(sources).values(row);
		const [created] = await this.db.db
			.select()
			.from(sources)
			.where(eq(sources.id, id))
			.limit(1);
		return toDto(created!);
	}

	async update(id: string, input: UpdateSourceInput): Promise<Source> {
		const patch: Record<string, unknown> = {};
		if (input.name !== undefined) patch.name = input.name;
		if (input.enabled !== undefined) patch.enabled = input.enabled;
		if (input.fetchWindowDays !== undefined) {
			patch.fetchWindowDays = Math.max(0, Math.floor(input.fetchWindowDays));
		}
		if (input.configuration !== undefined) {
			patch.configuration = input.configuration;
		}
		if (Object.keys(patch).length > 0) {
			await this.db.db.update(sources).set(patch).where(eq(sources.id, id));
		}
		return this.get(id);
	}

	async remove(id: string): Promise<void> {
		await this.db.db.delete(sources).where(eq(sources.id, id));
		// Stale FTS5 entries (from cascade-deleted articles) are invisible
		// in search results because the query INNER JOINs articles. Rebuild
		// the index to reclaim space from stale entries.
		ftsRebuildIndex(this.db.rawDb);
	}

	async setEnabled(id: string, enabled: boolean): Promise<Source> {
		return this.update(id, { enabled });
	}
}

function toDto(row: {
	id: string;
	name: string;
	url: string;
	type: string;
	category: string;
	adapter: string;
	configuration: unknown;
	enabled: boolean;
	fetchWindowDays: number | null;
	lastCheckedAt: Date | null;
	createdAt: Date;
}): Source {
	return {
		id: row.id,
		name: row.name,
		url: row.url,
		type: row.type as Source["type"],
		category: row.category as Source["category"],
		adapter: row.adapter,
		configuration: (row.configuration ?? {}) as Source["configuration"],
		enabled: row.enabled,
		fetchWindowDays: row.fetchWindowDays ?? 7,
		lastCheckedAt: row.lastCheckedAt,
		createdAt: row.createdAt,
	};
}

function defaultAdapterFor(type: CreateSourceInput["type"]): string {
	if (type === "rss") return "rss";
	return "rss";
}

function slugify(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
}
