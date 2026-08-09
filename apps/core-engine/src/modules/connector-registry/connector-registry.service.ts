import {
	Inject,
	Injectable,
	Logger,
	Optional,
	ServiceUnavailableException,
} from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../../db/database.service.js";
import {
	connectorManifests,
	type ConnectorManifestRow,
} from "../../db/schema.js";
import type { AdapterManifest } from "../plugins/plugins.manifests.js";
import {
	VORYNTH_VERSION,
	type ConfigField,
	type SourceType,
} from "@vorynth/types";
import type { RefreshConnectorsResult } from "@vorynth/types";

/**
 * Text fetcher for the official connector registry. The real implementation
 * hits GitHub; tests inject a stub so `refresh()` runs fully offline (same
 * pattern as SourceListsService.CatalogFetcher).
 */
export interface ConnectorRegistryFetcher {
	getText(url: string): Promise<string | null>;
}

/** Connector ids must be URL-safe slugs (same rule as source lists). */
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

const DEFAULT_REPO = "omidnw/vorynth";
const DEFAULT_REPO_REF = "master";
const DEFAULT_RAW_BASE = "https://raw.githubusercontent.com";

/**
 * Adapter implementations compiled into the engine (trusted, no bundle
 * execution — R-A13). A registry entry is only usable when its id is in this
 * set: that is the gate that keeps a connector whose code isn't in the user's
 * app build from registering and then silently failing at collect time.
 */
export const COMPILED_ADAPTER_IDS = new Set([
	"rss",
	"github-releases",
	"arxiv",
	"html",
	"sitemap",
	"api",
]);

/** One entry from `connectors/registry.json`. */
interface RegistryConnectorFile {
	id: string;
	sourceType: string;
	name: string;
	description?: string;
	version: string;
	configFields?: ConfigField[];
	icon?: string;
	iconSrc?: string;
	tier?: string;
	minVorynthVersion?: string;
}

/**
 * Official connector registry (v1.8.0) — the auto-provisioning source.
 *
 * The registry lives on GitHub (`connectors/registry.json` in the Vorynth
 * repo) and distributes connector DEFINITIONS — which source type a connector
 * serves, its Add Source config schema, its icon and tier. The ADAPTER
 * IMPLEMENTATION stays compiled in the engine; a registered official connector
 * resolves exactly like a built-in. The cached rows ARE the offline catalog:
 * a failed refresh never clears them, and the first fetch at boot provisions
 * the shipped official connectors (e.g. arXiv) without user action.
 */
@Injectable()
export class ConnectorRegistryService {
	private readonly logger = new Logger("ConnectorRegistry");
	private readonly repo: string;
	private readonly repoRef: string;
	private readonly rawBase: string;
	private readonly fetchText: (url: string) => Promise<string | null>;

	constructor(
		@Inject(DatabaseService) private readonly db: DatabaseService,
		@Optional() fetcher?: ConnectorRegistryFetcher,
	) {
		this.repo = process.env.VORYNTH_CONNECTORS_REPO ?? DEFAULT_REPO;
		this.repoRef = process.env.VORYNTH_CONNECTORS_REPO_REF ?? DEFAULT_REPO_REF;
		this.rawBase = process.env.VORYNTH_CONNECTORS_RAW_BASE ?? DEFAULT_RAW_BASE;
		// Default fetcher hits the network; tests inject a stub (offline).
		this.fetchText = fetcher ? (url) => fetcher.getText(url) : defaultFetch;
	}

	/** Provision the shipped official connectors at boot. Offline is fine —
	 *  they stay provisioned once cached, and the next refresh updates them. */
	async onModuleInit(): Promise<void> {
		try {
			await this.refresh();
		} catch (err) {
			this.logger.warn(
				`connector registry refresh at boot failed (offline ok): ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
		}
	}

	/** Every registered official connector (the offline cache). */
	registeredRows(): ConnectorManifestRow[] {
		return this.db.db.select().from(connectorManifests).all();
	}

	/** A registered connector by id, as a manifest the plugin system merges. */
	registeredManifest(id: string): AdapterManifest | null {
		const rows = this.db.db
			.select()
			.from(connectorManifests)
			.where(eq(connectorManifests.id, id))
			.limit(1)
			.all();
		return rows[0] ? toManifest(rows[0]) : null;
	}

	/** A registered connector serving a source type, or null. */
	registeredForType(sourceType: SourceType): AdapterManifest | null {
		const rows = this.db.db
			.select()
			.from(connectorManifests)
			.where(eq(connectorManifests.sourceType, sourceType))
			.limit(1)
			.all();
		return rows[0] ? toManifest(rows[0]) : null;
	}

	/**
	 * Auto-provisioning (v1.8.0): ensure a connector exists for a source type.
	 * Registered locally → its manifest. Not registered → refresh the GitHub
	 * registry once → found → registered. Returns null when no usable official
	 * connector exists (the caller shows a good error); a reachability failure
	 * throws REGISTRY_UNREACHABLE.
	 */
	async ensureForType(sourceType: SourceType): Promise<AdapterManifest | null> {
		const local = this.registeredForType(sourceType);
		if (local) return local;
		await this.refresh();
		return this.registeredForType(sourceType);
	}

	/**
	 * Fetch + validate + upsert the GitHub registry. The stored rows ARE the
	 * offline catalog: entries whose file changed are updated in place, new
	 * ones are registered, and a failed fetch never clears anything.
	 */
	async refresh(): Promise<RefreshConnectorsResult> {
		const result: RefreshConnectorsResult = {
			added: [],
			updated: [],
			unchanged: [],
			skipped: [],
		};

		const url = `${this.rawBase}/${this.repo}/${this.repoRef}/connectors/registry.json`;
		const body = await this.fetchText(url);
		if (!body) {
			throw new ServiceUnavailableException({
				code: "REGISTRY_UNREACHABLE",
				message: `Could not reach the official connector registry (${this.repo}). Registered connectors are unchanged.`,
			});
		}

		let parsed: { connectors?: unknown };
		try {
			parsed = JSON.parse(body) as { connectors?: unknown };
		} catch {
			throw new ServiceUnavailableException({
				code: "REGISTRY_INVALID",
				message: "The connector registry response was not valid JSON.",
			});
		}

		const entries = Array.isArray(parsed?.connectors) ? parsed.connectors : [];
		const existingRows = this.db.db.select().from(connectorManifests).all();
		const existingById = new Map(existingRows.map((r) => [r.id, r]));

		for (const raw of entries) {
			const def = this.parseConnector(raw as Record<string, unknown>);
			if (!def) {
				result.skipped.push(
					typeof (raw as Record<string, unknown>)?.id === "string"
						? ((raw as Record<string, unknown>).id as string)
						: "?",
				);
				continue;
			}
			// The compiled-adapter gate: a connector whose implementation isn't in
			// this app build can't collect — skip it, don't register a shell.
			if (!COMPILED_ADAPTER_IDS.has(def.id)) {
				result.skipped.push(def.id);
				this.logger.warn(
					`registry: connector '${def.id}' has no compiled adapter in this build — skipped (needs a newer Vorynth).`,
				);
				continue;
			}
			if (
				def.minVorynthVersion &&
				!versionAtLeast(VORYNTH_VERSION, def.minVorynthVersion)
			) {
				result.skipped.push(def.id);
				this.logger.warn(
					`registry: connector '${def.id}' requires Vorynth >= ${def.minVorynthVersion}, app is ${VORYNTH_VERSION} — skipped.`,
				);
				continue;
			}

			const existing = existingById.get(def.id);
			if (existing) {
				const same =
					existing.name === def.name &&
					existing.description === (def.description ?? "") &&
					existing.version === def.version &&
					existing.icon === (def.icon ?? null) &&
					existing.iconSrc === (def.iconSrc ?? null) &&
					JSON.stringify(existing.configFields) ===
						JSON.stringify(def.configFields ?? []);
				if (same) {
					result.unchanged.push(def.id);
				} else {
					await this.db.db
						.update(connectorManifests)
						.set({
							name: def.name,
							description: def.description ?? "",
							version: def.version,
							configFields: def.configFields ?? [],
							icon: def.icon,
							iconSrc: def.iconSrc,
							minVorynthVersion: def.minVorynthVersion ?? null,
							updatedAt: new Date(),
						})
						.where(eq(connectorManifests.id, existing.id));
					result.updated.push(def.id);
				}
			} else {
				await this.db.db.insert(connectorManifests).values({
					id: def.id,
					sourceType: def.sourceType,
					name: def.name,
					description: def.description ?? "",
					version: def.version,
					configFields: def.configFields ?? [],
					icon: def.icon,
					iconSrc: def.iconSrc,
					tier: "official",
					minVorynthVersion: def.minVorynthVersion ?? null,
					createdAt: new Date(),
				});
				this.syncPluginRow(def);
				result.added.push(def.id);
			}
		}

		this.logger.log(
			`connector registry refresh: +${result.added.length} ~${result.updated.length} =${result.unchanged.length} skip${result.skipped.length}`,
		);
		return result;
	}

	/** Validate one registry entry → normalized definition, or null. */
	private parseConnector(
		raw: Record<string, unknown>,
	): RegistryConnectorFile | null {
		if (typeof raw?.id !== "string" || !ID_RE.test(raw.id)) return null;
		const sourceType = raw.sourceType;
		if (typeof sourceType !== "string") return null;
		const name = raw.name;
		if (typeof name !== "string" || name.trim().length === 0) return null;
		const version = raw.version;
		if (typeof version !== "string" || version.trim().length === 0) return null;
		const configFields = Array.isArray(raw.configFields)
			? (raw.configFields as ConfigField[])
			: [];
		return {
			id: raw.id,
			sourceType,
			name,
			description: typeof raw.description === "string" ? raw.description : "",
			version,
			configFields,
			icon: typeof raw.icon === "string" ? raw.icon : undefined,
			iconSrc: typeof raw.iconSrc === "string" ? raw.iconSrc : undefined,
			tier: "official",
			minVorynthVersion:
				typeof raw.minVorynthVersion === "string"
					? raw.minVorynthVersion
					: undefined,
		};
	}

	/**
	 * Ensure the connector has a `plugins` row so it toggles exactly like a
	 * built-in (seed-style INSERT OR IGNORE — re-refresh never resets state).
	 */
	private syncPluginRow(def: RegistryConnectorFile): void {
		this.db.rawDb
			.prepare(
				`INSERT OR IGNORE INTO plugins (id, name, type, configuration, enabled)
				 VALUES (?, ?, ?, '{}', 1)`,
			)
			.run(def.id, def.name, def.sourceType);
	}
}

/** A cached registry row, as a manifest the plugin system can merge. */
function toManifest(row: ConnectorManifestRow): AdapterManifest {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		version: row.version,
		kind: "adapter",
		type: row.sourceType as SourceType,
		icon: row.icon ?? undefined,
		iconSrc: row.iconSrc ?? undefined,
		tier: "official",
		enabledByDefault: true,
		configFields: (row.configFields ?? []) as ConfigField[],
	};
}

/** "1.8.0" >= "1.8.0" style semver-ish compare (major.minor.patch). */
function versionAtLeast(current: string, min: string): boolean {
	const cur = current.split(".").map((n) => Number.parseInt(n, 10) || 0);
	const req = min.split(".").map((n) => Number.parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(cur.length, req.length); i += 1) {
		const c = cur[i] ?? 0;
		const r = req[i] ?? 0;
		if (c > r) return true;
		if (c < r) return false;
	}
	return true;
}

/** Plain fetch wrapper — mirrors SourceListsService.defaultFetch. */
async function defaultFetch(url: string): Promise<string | null> {
	try {
		const res = await fetch(url, {
			headers: {
				"user-agent":
					"Mozilla/5.0 (compatible; Vorynth/1.8; +https://vorynth.local)",
			},
			redirect: "follow",
			signal: AbortSignal.timeout(15_000),
		});
		if (!res.ok) return null;
		return await res.text();
	} catch {
		return null;
	}
}
