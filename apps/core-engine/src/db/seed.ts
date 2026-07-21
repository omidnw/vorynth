import Database from "better-sqlite3";
import { resolveDbPath } from "./paths.js";

/**
 * `pnpm db:seed` — seeds sources spanning every Vorynth domain so the
 * zero-configuration news reader has real breadth on first launch.
 *
 * Idempotent: re-running updates each source in place rather than duplicating.
 * Every source is RSS-only for the slice (HTML/GitHub/Reddit land in Phase 6).
 */
const SEED_SOURCES = [
	// Artificial Intelligence
	{
		id: "src-openai-blog",
		name: "OpenAI Blog",
		url: "https://openai.com/blog/rss.xml",
		type: "rss",
		category: "ai",
		adapter: "rss",
		configuration: { feedUrl: "https://openai.com/blog/rss.xml" },
	},
	{
		id: "src-huggingface",
		name: "Hugging Face Blog",
		url: "https://huggingface.co/blog/feed.xml",
		type: "rss",
		category: "ai",
		adapter: "rss",
		configuration: { feedUrl: "https://huggingface.co/blog/feed.xml" },
	},
	// Software Engineering
	{
		id: "src-github-blog",
		name: "The GitHub Blog",
		url: "https://github.blog/feed/",
		type: "rss",
		category: "software-engineering",
		adapter: "rss",
		configuration: { feedUrl: "https://github.blog/feed/" },
	},
	{
		id: "src-martin-fowler",
		name: "Martin Fowler",
		url: "https://martinfowler.com/feed.atom",
		type: "rss",
		category: "software-engineering",
		adapter: "rss",
		configuration: { feedUrl: "https://martinfowler.com/feed.atom" },
	},
	// Web Development
	{
		id: "src-web-dev",
		name: "web.dev",
		url: "https://web.dev/feed.xml",
		type: "rss",
		category: "web-development",
		adapter: "rss",
		configuration: { feedUrl: "https://web.dev/feed.xml" },
	},
	// Backend
	{
		id: "src-cloudflare",
		name: "Cloudflare Blog",
		url: "https://blog.cloudflare.com/rss/",
		type: "rss",
		category: "backend",
		adapter: "rss",
		configuration: { feedUrl: "https://blog.cloudflare.com/rss/" },
	},
	// DevOps
	{
		id: "src-hashicorp",
		name: "HashiCorp Blog",
		url: "https://www.hashicorp.com/blog/feed.xml",
		type: "rss",
		category: "devops",
		adapter: "rss",
		configuration: { feedUrl: "https://www.hashicorp.com/blog/feed.xml" },
	},
	// Cloud
	{
		id: "src-aws",
		name: "AWS News Blog",
		url: "https://aws.amazon.com/blogs/aws/feed/",
		type: "rss",
		category: "cloud",
		adapter: "rss",
		configuration: { feedUrl: "https://aws.amazon.com/blogs/aws/feed/" },
	},
	// Security
	{
		id: "src-krebs",
		name: "Krebs on Security",
		url: "https://krebsonsecurity.com/feed/",
		type: "rss",
		category: "security",
		adapter: "rss",
		configuration: { feedUrl: "https://krebsonsecurity.com/feed/" },
	},
	{
		id: "src-cloudflare-security",
		name: "Cloudflare Security",
		url: "https://blog.cloudflare.com/security/feed/",
		type: "rss",
		category: "security",
		adapter: "rss",
		configuration: { feedUrl: "https://blog.cloudflare.com/security/feed/" },
	},
	// Open Source
	{
		id: "src-openssf",
		name: "OpenSSF Blog",
		url: "https://openssf.org/blog/feed/",
		type: "rss",
		category: "open-source",
		adapter: "rss",
		configuration: { feedUrl: "https://openssf.org/blog/feed/" },
	},
	// Programming Languages
	{
		id: "src-rust",
		name: "Rust Blog",
		url: "https://blog.rust-lang.org/feed.xml",
		type: "rss",
		category: "programming-languages",
		adapter: "rss",
		configuration: { feedUrl: "https://blog.rust-lang.org/feed.xml" },
	},
	{
		id: "src-python",
		name: "Python Insider",
		url: "https://pythoninsider.blogspot.com/feeds/posts/default",
		type: "rss",
		category: "programming-languages",
		adapter: "rss",
		configuration: {
			feedUrl: "https://pythoninsider.blogspot.com/feeds/posts/default",
		},
	},
];

async function main() {
	const filePath = resolveDbPath();
	const db = new Database(filePath);
	db.pragma("foreign_keys = ON");

	const upsert = db.prepare(`
    INSERT INTO sources (id, name, url, type, category, adapter, configuration, enabled)
    VALUES (@id, @name, @url, @type, @category, @adapter, @configuration, 1)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      url = excluded.url,
      type = excluded.type,
      category = excluded.category,
      adapter = excluded.adapter,
      configuration = excluded.configuration
  `);

	for (const s of SEED_SOURCES) {
		upsert.run({ ...s, configuration: JSON.stringify(s.configuration) });
	}
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
