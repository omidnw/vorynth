#!/usr/bin/env node
/**
 * Connector health check (v1.8.0) — proves every cataloged source adapter still
 * works against the real internet, nightly.
 *
 * Reads the reference-source catalog (`src/health/reference-sources.ts`, built
 * to `dist/health/reference-sources.js`) and runs each adapter's `validate()`
 * + `fetch()` against one live endpoint, asserting the collection contract
 * (≥ expectedMin titled items). A connector that silently collects nothing —
 * the classic "No new articles found" rot — turns into a loud CI failure.
 *
 * Reddit is NOT cataloged (see reference-sources.ts): we never probe Reddit
 * from our own infra, so its adapter has no reference source by design.
 *
 * Usage:
 *   pnpm --filter @vorynth/core-engine build        # imports from dist/
 *   node scripts/connector-health.mjs               # every cataloged connector
 *   node scripts/connector-health.mjs --source rss  # one connector
 *
 * Exit code: 0 when every run passes, 1 when any fails (latency over budget
 * is reported but never fails the run — slow isn't broken).
 */
import { Logger } from "@nestjs/common";
import { RssAdapter } from "../dist/modules/crawler/adapters/rss-adapter.js";
import { GithubReleasesAdapter } from "../dist/modules/crawler/adapters/github-releases-adapter.js";
import { ArxivAdapter } from "../dist/modules/crawler/adapters/arxiv-adapter.js";
import { HtmlAdapter } from "../dist/modules/crawler/adapters/html-adapter.js";
import { SitemapAdapter } from "../dist/modules/crawler/adapters/sitemap-adapter.js";
import { ApiAdapter } from "../dist/modules/crawler/adapters/api-adapter.js";
import { REFERENCE_SOURCES } from "../dist/health/reference-sources.js";

// Silence the adapters' own Nest Logger — the health table is the output.
Logger.overrideLogger(false);

/** Adapter instances are DI-free plain classes — construct them directly. */
const ADAPTERS = {
	rss: new RssAdapter(),
	"github-releases": new GithubReleasesAdapter(),
	arxiv: new ArxivAdapter(),
	html: new HtmlAdapter(),
	sitemap: new SitemapAdapter(),
	api: new ApiAdapter(),
};

function argValue(name) {
	const i = process.argv.indexOf(name);
	return i !== -1 ? process.argv[i + 1] : undefined;
}

const sourceFilter = argValue("--source");
const targets = sourceFilter
	? REFERENCE_SOURCES.filter((r) => r.adapter === sourceFilter)
	: REFERENCE_SOURCES;

if (targets.length === 0) {
	console.error(`No reference sources match --source "${sourceFilter}".`);
	process.exit(1);
}

/** Run one reference source; returns { ok, warn, detail, slow } without
 *  throwing. A failed run on a `knownFlaky` source becomes a warning — its
 *  failure is environmental (CI blocks the host), not a connector bug. */
async function runReference(ref) {
	const adapter = ADAPTERS[ref.adapter];
	if (!adapter) {
		return {
			ok: false,
			warn: false,
			detail: `no adapter registered for '${ref.adapter}'`,
			slow: false,
		};
	}

	const started = performance.now();
	let items = [];
	let ok = false;
	let detail = "";
	let slow = false;
	try {
		const valid = await adapter.validate(ref.config);
		if (!valid) {
			detail =
				"validate() failed — config no longer matches the adapter contract";
		} else {
			items = await adapter.fetch(ref.config);
			const ms = Math.round(performance.now() - started);
			const untitled = items.filter(
				(i) => !(typeof i.title === "string" && i.title.trim()),
			).length;
			ok = items.length >= ref.expectedMin && untitled === 0;
			detail = `${items.length} item(s) in ${ms}ms`;
			if (untitled > 0) detail += ` — ${untitled} untitled`;
			if (ref.maxLatencyMs && ms > ref.maxLatencyMs) {
				slow = true;
				detail += ` (over ${ref.maxLatencyMs}ms budget)`;
			}
		}
	} catch (err) {
		const ms = Math.round(performance.now() - started);
		detail = `threw after ${ms}ms: ${err?.message ?? String(err)}`;
	}
	if (!ok && ref.knownFlaky === true) {
		return { ok: false, warn: true, detail, slow };
	}
	return { ok, warn: false, detail, slow };
}

const pad = (s, n) => String(s).padEnd(n);
const rows = [];
for (const ref of targets) {
	rows.push({ ref, ...(await runReference(ref)) });
}

const mark = (r) => (r.ok ? "✓" : r.warn ? "⚠" : "✗");
console.log("\nConnector health check — real network\n" + "-".repeat(72));
for (const r of rows) {
	const over = r.ok && r.slow ? " (slow)" : "";
	const flaky = r.warn
		? ` — ${r.ref.note ?? "known-flaky (expected in CI)"}`
		: "";
	console.log(
		`${mark(r)} ${pad(r.ref.adapter, 16)} ${pad(r.ref.name, 28)} ${r.detail}${over}${flaky}`,
	);
}
console.log("-".repeat(72));

const passed = rows.filter((r) => r.ok).length;
const warnings = rows.filter((r) => r.warn).length;
const failed = rows.length - passed - warnings;
console.log(
	`${passed} passed, ${failed} failed${warnings > 0 ? `, ${warnings} flaky (expected)` : ""}`,
);
if (failed > 0) {
	console.log(
		"✗ A connector stopped collecting — fix it or swap the reference source (see src/health/reference-sources.ts).",
	);
} else if (warnings > 0) {
	console.log(
		"⚠ Only known-flaky connectors failed — expected from CI networks.",
	);
} else {
	console.log("✓ Every connector collected as expected.");
}
process.exit(failed > 0 ? 1 : 0);
