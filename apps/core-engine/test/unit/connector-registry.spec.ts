import { ServiceUnavailableException } from "@nestjs/common";
import { createTestDb } from "../helpers/db.js";
import {
	ConnectorRegistryService,
	type ConnectorRegistryFetcher,
} from "../../src/modules/connector-registry/connector-registry.service.js";
import { PluginsService } from "../../src/modules/plugins/plugins.service.js";

/**
 * Official connector registry (v1.8.0) — OFFLINE ONLY (injected fetcher, per
 * /testing-backend). Proves the GitHub catalog flow: parse + validate (the
 * compiled-adapter and version gates), upsert with the plugins-row sync, the
 * never-cleared offline cache, and auto-provisioning (ensureForType).
 */
describe("Connector registry — official connector provisioning (v1.8.0)", () => {
	const REGISTRY_BODY = JSON.stringify({
		connectors: [
			{
				id: "arxiv",
				sourceType: "arxiv",
				name: "arXiv",
				description: "Scientific preprints.",
				version: "1.8.0",
				configFields: [
					{
						key: "query",
						label: "Search query",
						type: "text",
						required: true,
						placeholder: "cat:cs.AI",
					},
				],
				icon: "science",
				iconSrc: "/plugins/arxiv/icon.svg",
				tier: "official",
				minVorynthVersion: "1.8.0",
			},
			// Compiled-adapter gate: no such adapter implementation in the build.
			{
				id: "quantum",
				sourceType: "quantum",
				name: "Quantum",
				version: "1.0.0",
			},
			// Version gate: requires a newer Vorynth than the current build.
			{
				id: "rss",
				sourceType: "rss",
				name: "RSS (v9)",
				version: "9.0.0",
				minVorynthVersion: "99.0.0",
			},
		],
	});

	function stubFetcher(body: string | null): ConnectorRegistryFetcher {
		return { getText: async () => body };
	}

	it("provisions a valid entry, syncs its plugins row, and merges into the plugin list", async () => {
		const db = createTestDb();
		try {
			const registry = new ConnectorRegistryService(
				db.service,
				stubFetcher(REGISTRY_BODY),
			);
			const result = await registry.refresh();

			expect(result.added).toEqual(["arxiv"]);
			expect(result.skipped.sort()).toEqual(["quantum", "rss"]);

			// The provisioned connector resolves by source type and by id, with
			// its configFields + official tier intact.
			const manifest = registry.registeredForType("arxiv");
			expect(manifest).toMatchObject({
				id: "arxiv",
				kind: "adapter",
				type: "arxiv",
				tier: "official",
				icon: "science",
				iconSrc: "/plugins/arxiv/icon.svg",
			});
			expect(manifest?.configFields[0]).toMatchObject({ key: "query" });

			// And it merges into the plugin system exactly like a built-in: the
			// plugins row is synced (toggleable) and adapterFor resolves it.
			const plugins = new PluginsService(db.service, registry);
			const list = await plugins.list();
			const arxiv = list.find((p) => p.id === "arxiv");
			expect(arxiv).toMatchObject({
				tier: "official",
				enabled: true,
				effectiveEnabled: true,
			});
			expect(plugins.adapterFor("arxiv")).toBe("arxiv");
		} finally {
			db.close();
		}
	});

	it("auto-provisions on demand: ensureForType registers a missing connector once", async () => {
		const db = createTestDb();
		try {
			const registry = new ConnectorRegistryService(
				db.service,
				stubFetcher(REGISTRY_BODY),
			);
			// Not registered yet.
			expect(registry.registeredForType("arxiv")).toBeNull();
			// ensureForType fetches once and registers.
			const manifest = await registry.ensureForType("arxiv");
			expect(manifest?.id).toBe("arxiv");
			expect(registry.registeredForType("arxiv")?.id).toBe("arxiv");
			// A second ensureForType is served from the local cache (no refetch).
			expect((await registry.ensureForType("arxiv"))?.id).toBe("arxiv");
		} finally {
			db.close();
		}
	});

	it("returns null when no official connector exists for the source type", async () => {
		const db = createTestDb();
		try {
			const registry = new ConnectorRegistryService(
				db.service,
				stubFetcher(REGISTRY_BODY),
			);
			await expect(registry.ensureForType("quantum")).resolves.toBeNull();
		} finally {
			db.close();
		}
	});

	it("a reachability failure throws REGISTRY_UNREACHABLE and never clears the cache", async () => {
		const db = createTestDb();
		try {
			const registry = new ConnectorRegistryService(
				db.service,
				stubFetcher(REGISTRY_BODY),
			);
			await registry.refresh(); // populated
			const offline = new ConnectorRegistryService(
				db.service,
				stubFetcher(null),
			);
			await expect(offline.refresh()).rejects.toBeInstanceOf(
				ServiceUnavailableException,
			);
			// The cache survives the failed refresh.
			expect(offline.registeredForType("arxiv")?.id).toBe("arxiv");
		} finally {
			db.close();
		}
	});
});
