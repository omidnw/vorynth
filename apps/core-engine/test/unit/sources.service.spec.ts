import { BadRequestException } from "@nestjs/common";
import { createTestDb, type TestDb } from "../helpers/db.js";
import { SourcesService } from "../../src/modules/sources/sources.service.js";
import { ConnectorRegistryService } from "../../src/modules/connector-registry/connector-registry.service.js";

/**
 * Sources service — geography/language tag persistence (v1.8.0) and the bulk
 * group enable/disable endpoint behind the Sources page master switches.
 * Plugins/Crawler are stubbed (create/update paths tested here don't touch
 * them beyond what create() already validates).
 */
describe("SourcesService — tags + bulk group enable (v1.8.0)", () => {
	let db: TestDb;
	let service: SourcesService;

	beforeEach(() => {
		db = createTestDb();
		service = new SourcesService(
			db.service,
			{
				adapterFor: () => "rss",
				validateConfig: () => null,
			} as unknown as ConstructorParameters<typeof SourcesService>[1],
			{} as never,
			new ConnectorRegistryService(db.service),
		);
	});

	afterEach(() => db.close());

	it("persists country/city/language on create and returns them in the DTO", async () => {
		const created = await service.create({
			name: "My Spanish Blog",
			url: "https://example.com/feed.xml",
			type: "rss",
			category: "ai",
			country: "es",
			city: "Madrid",
			language: "ES",
		});
		expect(created.country).toBe("ES");
		expect(created.city).toBe("Madrid");
		expect(created.language).toBe("es");

		const fetched = await service.get(created.id);
		expect(fetched.country).toBe("ES");
		expect(fetched.language).toBe("es");
	});

	it("rejects a malformed country/language code", async () => {
		await expect(
			service.create({
				name: "Bad",
				url: "https://example.com/feed.xml",
				type: "rss",
				category: "other",
				country: "USA",
			}),
		).rejects.toBeInstanceOf(BadRequestException);
		await expect(
			service.update("src-aws", { language: "engl" }),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("bulk-enables and disables every source in a group", async () => {
		const before = await service.list();
		const securityIds = before
			.filter((s) => s.category === "security")
			.map((s) => s.id);
		expect(securityIds.length).toBeGreaterThanOrEqual(3);

		const off = await service.bulkEnable({
			dimension: "category",
			value: "security",
			enabled: false,
		});
		expect(off.updated).toBe(securityIds.length);
		const after = await service.list();
		for (const s of after.filter((x) => x.category === "security")) {
			expect(s.enabled).toBe(false);
		}
		// Other categories are untouched.
		expect(
			after.filter((x) => x.category === "ai").every((x) => x.enabled),
		).toBe(true);

		const on = await service.bulkEnable({
			dimension: "category",
			value: "security",
			enabled: true,
		});
		expect(on.updated).toBe(securityIds.length);
	});

	it("bulk-enables by country and ignores untagged rows", async () => {
		// Two DE sources exist (smashing); disable them by country code.
		const off = await service.bulkEnable({
			dimension: "country",
			value: "de",
			enabled: false,
		});
		expect(off.updated).toBeGreaterThanOrEqual(1);
		const deRows = (await service.list()).filter((s) => s.country === "DE");
		expect(deRows.every((s) => s.enabled === false)).toBe(true);
	});

	it("rejects unknown dimensions and empty values", async () => {
		await expect(
			service.bulkEnable({
				dimension: "galaxy" as never,
				value: "x",
				enabled: true,
			}),
		).rejects.toBeInstanceOf(BadRequestException);
		await expect(
			service.bulkEnable({
				dimension: "category",
				value: "   ",
				enabled: true,
			}),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("persists scope/authority/impact areas on create and returns them in the DTO", async () => {
		const created = await service.create({
			name: "My Research Blog",
			url: "https://example.com/feed.xml",
			type: "rss",
			category: "ai",
			scope: "regional",
			authority: "research",
			impactAreas: ["AI", "  Security  ", "AI", "web"],
		});
		// Impact areas are normalized: lowercase slugs, deduped, trimmed.
		expect(created.scope).toBe("regional");
		expect(created.authority).toBe("research");
		expect(created.impactAreas).toEqual(["ai", "security", "web"]);

		const fetched = await service.get(created.id);
		expect(fetched.scope).toBe("regional");
		expect(fetched.impactAreas).toEqual(["ai", "security", "web"]);
	});

	it("updates and clears semantic metadata via update", async () => {
		const updated = await service.update("src-aws", {
			authority: "media",
			impactAreas: ["cloud", "infrastructure"],
		});
		expect(updated.authority).toBe("media");
		expect(updated.impactAreas).toEqual(["cloud", "infrastructure"]);
		// Explicit null clears a field.
		const cleared = await service.update("src-aws", {
			authority: null,
			impactAreas: null,
		});
		expect(cleared.authority).toBeNull();
		expect(cleared.impactAreas).toBeNull();
	});

	it("persists free-form tags on create — normalized, deduped, capped", async () => {
		const created = await service.create({
			name: "Tagged Source",
			url: "https://example.com/feed.xml",
			type: "rss",
			category: "ai",
			tags: ["Cloud", "  AI  ", "cloud", "React", "ai"],
		});
		expect(created.tags).toEqual(["cloud", "ai", "react"]);

		const fetched = await service.get(created.id);
		expect(fetched.tags).toEqual(["cloud", "ai", "react"]);
	});

	it("updates and clears tags via update", async () => {
		const created = await service.create({
			name: "Tagged Source",
			url: "https://example.com/feed.xml",
			type: "rss",
			category: "ai",
			tags: ["cloud"],
		});
		const updated = await service.update(created.id, {
			tags: ["ai", "cloud", "ai"],
		});
		expect(updated.tags).toEqual(["ai", "cloud"]);

		const cleared = await service.update(created.id, { tags: null });
		expect(cleared.tags).toBeNull();
	});

	it("rejects unknown scope/authority values", async () => {
		await expect(
			service.create({
				name: "Bad",
				url: "https://example.com/feed.xml",
				type: "rss",
				category: "other",
				scope: "galactic" as never,
			}),
		).rejects.toBeInstanceOf(BadRequestException);
		await expect(
			service.update("src-aws", { authority: "government" as never }),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("auto-provisions an official connector when creating a source of an unregistered type", async () => {
		const registry = new ConnectorRegistryService(db.service, {
			getText: async () =>
				JSON.stringify({
					connectors: [
						{
							id: "arxiv",
							sourceType: "arxiv",
							name: "arXiv",
							version: "1.8.0",
							configFields: [
								{
									key: "query",
									label: "Search query",
									type: "text",
									required: true,
								},
							],
						},
					],
				}),
		});
		// Plugins stub mirrors the real merged adapterFor: registered official
		// connectors resolve; unregistered types throw (the resolution hook then
		// fetches from the registry and retries).
		const plugins = {
			adapterFor: (type: string) => {
				const local = registry.registeredForType(type as never);
				if (type === "rss") return "rss";
				if (local) return local.id;
				throw new Error(`no adapter registered for source type '${type}'`);
			},
			validateConfig: () => null,
		} as unknown as ConstructorParameters<typeof SourcesService>[1];
		const svc = new SourcesService(db.service, plugins, {} as never, registry);

		const created = await svc.create({
			name: "arXiv AI",
			url: "https://arxiv.org",
			type: "arxiv",
			category: "ai",
			configuration: { query: "cat:cs.AI" },
		});
		expect(created.adapter).toBe("arxiv");
		// The connector is now registered locally.
		expect(registry.registeredForType("arxiv")?.id).toBe("arxiv");
	});

	it("rejects a source type with no official connector (CONNECTOR_NOT_AVAILABLE)", async () => {
		const registry = new ConnectorRegistryService(db.service, {
			getText: async () => JSON.stringify({ connectors: [] }),
		});
		const plugins = {
			adapterFor: () => {
				throw new Error("no adapter registered");
			},
			validateConfig: () => null,
		} as unknown as ConstructorParameters<typeof SourcesService>[1];
		const svc = new SourcesService(db.service, plugins, {} as never, registry);

		await expect(
			svc.create({
				name: "Nope",
				url: "https://example.com",
				type: "arxiv",
				category: "other",
			}),
		).rejects.toMatchObject({ response: { code: "CONNECTOR_NOT_AVAILABLE" } });
	});
});
