import { createTestDb } from "../helpers/db.js";
import {
	backfillSeedTags,
	repairSeedUrls,
} from "../../src/db/ddl.js";

/**
 * Seed feed-URL repairs (v1.8.0 data fix).
 *
 * `INSERT OR IGNORE` seeding never updates existing rows, so installs that
 * predate the feed-URL fixes keep the dead URLs. `repairSeedUrls` only touches
 * a row that still carries the exact dead URL — a user's custom URL edit is
 * never overwritten — and is idempotent.
 */
describe("repairSeedUrls", () => {
	function forceDeadUrl(
		db: ReturnType<typeof createTestDb>,
		id: string,
		deadUrl: string,
	): void {
		db.service.rawDb
			.prepare("UPDATE sources SET url = ?, configuration = ? WHERE id = ?")
			.run(deadUrl, JSON.stringify({ feedUrl: deadUrl }), id);
	}

	it("repairs rows still carrying the exact dead URL (url + config)", () => {
		const db = createTestDb();
		try {
			// Simulate the pre-fix state for two of the three repaired sources.
			forceDeadUrl(
				db,
				"src-cloudflare-security",
				"https://blog.cloudflare.com/security/feed/",
			);
			forceDeadUrl(db, "src-react", "https://react.dev/blog/rss.xml");

			repairSeedUrls(db.service.rawDb);

			const cloudflare = db.service.rawDb
				.prepare("SELECT url, configuration FROM sources WHERE id = ?")
				.get("src-cloudflare-security") as {
				url: string;
				configuration: string;
			};
			expect(cloudflare.url).toBe(
				"https://blog.cloudflare.com/tag/security/rss/",
			);
			expect(JSON.parse(cloudflare.configuration)).toEqual({
				feedUrl: "https://blog.cloudflare.com/tag/security/rss/",
			});

			const react = db.service.rawDb
				.prepare("SELECT url FROM sources WHERE id = ?")
				.get("src-react") as { url: string };
			expect(react.url).toBe("https://react.dev/feed.xml");
		} finally {
			db.close();
		}
	});

	it("never touches a row whose URL the user changed", () => {
		const db = createTestDb();
		try {
			forceDeadUrl(db, "src-react", "https://react.dev/blog/rss.xml");
			// A user edit moves the source to a custom feed — must survive.
			db.service.rawDb
				.prepare("UPDATE sources SET url = ? WHERE id = ?")
				.run("https://example.com/my-feed.xml", "src-react");

			repairSeedUrls(db.service.rawDb);

			const react = db.service.rawDb
				.prepare("SELECT url FROM sources WHERE id = ?")
				.get("src-react") as { url: string };
			expect(react.url).toBe("https://example.com/my-feed.xml");
		} finally {
			db.close();
		}
	});

	it("is idempotent — a second run changes nothing", () => {
		const db = createTestDb();
		try {
			forceDeadUrl(
				db,
				"src-cloudflare-security",
				"https://blog.cloudflare.com/security/feed/",
			);

			repairSeedUrls(db.service.rawDb);
			const afterFirst = db.service.rawDb
				.prepare("SELECT url FROM sources WHERE id = ?")
				.get("src-cloudflare-security") as { url: string };
			repairSeedUrls(db.service.rawDb);
			const afterSecond = db.service.rawDb
				.prepare("SELECT url FROM sources WHERE id = ?")
				.get("src-cloudflare-security") as { url: string };

			expect(afterFirst.url).toBe(
				"https://blog.cloudflare.com/tag/security/rss/",
			);
			expect(afterSecond.url).toBe(afterFirst.url);
		} finally {
			db.close();
		}
	});
});

describe("seed geography/language tags (v1.8.0)", () => {
	it("tags every seeded source with ISO country/language + city", () => {
		const db = createTestDb();
		try {
			const rows = db.service.rawDb
				.prepare(
					"SELECT id, country, city, language FROM sources WHERE list_id = 'developer'",
				)
				.all() as Array<{
				id: string;
				country: string | null;
				city: string | null;
				language: string | null;
			}>;
			expect(rows.length).toBe(24);
			for (const r of rows) {
				expect(r.country).toMatch(/^[A-Z]{2}$/);
				expect(r.language).toBe("en");
			}
			const smashing = rows.find((r) => r.id === "src-smashing");
			expect(smashing?.country).toBe("DE");
			expect(smashing?.city).toBe("Freiburg");
			const jvns = rows.find((r) => r.id === "src-jvns");
			expect(jvns?.country).toBe("CA");
			expect(jvns?.city).toBe("Montreal");
			const aws = rows.find((r) => r.id === "src-aws");
			expect(aws?.city).toBe("Seattle");
		} finally {
			db.close();
		}
	});

	it("backfills tags onto pre-column rows without overwriting user edits", () => {
		const db = createTestDb();
		try {
			// Simulate a row that predates the columns: untagged, then repaired.
			db.service.rawDb
				.prepare(
					"UPDATE sources SET country = NULL, city = NULL, language = NULL WHERE id = 'src-aws'",
				)
				.run();
			backfillSeedTags(db.service.rawDb);
			const aws = db.service.rawDb
				.prepare(
					"SELECT country, city, language FROM sources WHERE id = 'src-aws'",
				)
				.get() as {
				country: string | null;
				city: string | null;
				language: string | null;
			};
			expect(aws.country).toBe("US");
			expect(aws.city).toBe("Seattle");
			expect(aws.language).toBe("en");

			// A user edit must never be overwritten by the backfill.
			db.service.rawDb
				.prepare("UPDATE sources SET country = 'ZZ' WHERE id = 'src-aws'")
				.run();
			backfillSeedTags(db.service.rawDb);
			const edited = db.service.rawDb
				.prepare("SELECT country FROM sources WHERE id = 'src-aws'")
				.get() as { country: string };
			expect(edited.country).toBe("ZZ");
		} finally {
			db.close();
		}
	});
});

describe("seed semantic metadata (v1.8.0)", () => {
	it("classifies every seeded source with scope/authority/impact areas", () => {
		const db = createTestDb();
		try {
			const rows = db.service.rawDb
				.prepare(
					"SELECT id, scope, authority, impact_areas FROM sources WHERE list_id = 'developer'",
				)
				.all() as Array<{
				id: string;
				scope: string | null;
				authority: string | null;
				impact_areas: string | null;
			}>;
			expect(rows.length).toBe(24);
			for (const r of rows) {
				expect(r.scope).toMatch(/^(global|regional|national|local|community)$/);
				expect(r.authority).toMatch(
					/^(official|research|community|media|aggregator|personal)$/,
				);
				expect(r.impact_areas).not.toBeNull();
			}
			const cloudflare = rows.find((r) => r.id === "src-cloudflare");
			expect(cloudflare?.scope).toBe("global");
			expect(cloudflare?.authority).toBe("official");
			expect(JSON.parse(cloudflare!.impact_areas!)).toContain("internet");
			const fowler = rows.find((r) => r.id === "src-martin-fowler");
			expect(fowler?.authority).toBe("personal");
		} finally {
			db.close();
		}
	});

	it("backfills metadata onto pre-column rows without overwriting user edits", () => {
		const db = createTestDb();
		try {
			// Simulate a row that predates the metadata columns.
			db.service.rawDb
				.prepare(
					"UPDATE sources SET scope = NULL, authority = NULL, impact_areas = NULL WHERE id = 'src-aws'",
				)
				.run();
			backfillSeedTags(db.service.rawDb);
			const aws = db.service.rawDb
				.prepare(
					"SELECT scope, authority, impact_areas FROM sources WHERE id = 'src-aws'",
				)
				.get() as {
				scope: string | null;
				authority: string | null;
				impact_areas: string | null;
			};
			expect(aws.scope).toBe("global");
			expect(aws.authority).toBe("official");
			expect(JSON.parse(aws.impact_areas!)).toContain("cloud");

			// A user classification must never be overwritten.
			db.service.rawDb
				.prepare("UPDATE sources SET authority = 'community' WHERE id = 'src-aws'")
				.run();
			backfillSeedTags(db.service.rawDb);
			const edited = db.service.rawDb
				.prepare("SELECT authority FROM sources WHERE id = 'src-aws'")
				.get() as { authority: string };
			expect(edited.authority).toBe("community");
		} finally {
			db.close();
		}
	});
});
