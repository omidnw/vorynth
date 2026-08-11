#!/usr/bin/env node
/**
 * Regenerate the Tauri updater manifest (latest.json) from ALL signed
 * artifacts on a GitHub release.
 *
 * Why this exists: tauri-action writes latest.json once per matrix job. With
 * parallel platform jobs the file races — the last job's write drops entries
 * from earlier jobs (e.g. the darwin-* keys vanishing while linux/windows
 * survive). This script rebuilds the `platforms` object from every *.sig on
 * the release, so the manifest is always complete regardless of job order.
 *
 * Usage:
 *   GH_TOKEN=... node regenerate-latest-json.mjs <owner/repo> <tag>
 *
 * Writes ./latest.json; the caller uploads it to the release (--clobber).
 * Works unauthenticated on public repos (GH_TOKEN optional, avoids rate limits).
 */
import { writeFile } from "node:fs/promises";

const [repo, tag] = process.argv.slice(2);
if (!repo || !tag) {
	console.error("usage: regenerate-latest-json.mjs <owner/repo> <tag>");
	process.exit(1);
}

const token = process.env.GH_TOKEN;
const api = `https://api.github.com/repos/${repo}/releases`;
const headers = token ? { Authorization: `token ${token}` } : {};
const downloadUrl = (name) =>
	`https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(name)}`;

async function apiJson(url) {
	const res = await fetch(url, { headers });
	if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
	return res.json();
}

/** Find the release for the tag. Uses the LIST endpoint, not
 *  `releases/tags/:tag` — this job runs while the release is still a DRAFT,
 *  and the tags endpoint hides drafts (404). The list endpoint returns drafts
 *  when authenticated (GH_TOKEN). */
async function findReleaseByTag() {
	const list = await apiJson(`${api}?per_page=100`);
	const found = list.find((r) => r.tag_name === tag);
	if (!found) {
		throw new Error(
			`release for tag ${tag} not found (list endpoint returned ${list.length} releases)`,
		);
	}
	return found;
}

/** Map a signed bundle name to the updater platform keys it serves. Mirrors
 *  tauri-action's naming: linux/windows get a base key plus a suffixed one
 *  (AppImage/NSIS), macOS keeps the plain darwin-<arch> key. */
function keysFor(bundle) {
	const n = bundle.toLowerCase();
	if (n.endsWith(".app.tar.gz")) {
		return n.includes("x64") ? ["darwin-x86_64"] : ["darwin-aarch64"];
	}
	if (n.endsWith(".appimage")) {
		const arch = /aarch64|arm64/.test(n) ? "aarch64" : "x86_64";
		return [`linux-${arch}`, `linux-${arch}-appimage`];
	}
	if (n.endsWith(".deb")) {
		const arch = /aarch64|arm64/.test(n) ? "aarch64" : "x86_64";
		return [`linux-${arch}-deb`];
	}
	if (n.endsWith(".rpm")) {
		const arch = /aarch64|arm64/.test(n) ? "aarch64" : "x86_64";
		return [`linux-${arch}-rpm`];
	}
	if (n.endsWith("-setup.exe")) {
		const arch = n.includes("arm64") ? "aarch64" : "x86_64";
		return [`windows-${arch}-nsis`, `windows-${arch}`];
	}
	if (n.endsWith(".msi")) {
		const arch = n.includes("arm64") ? "aarch64" : "x86_64";
		return [`windows-${arch}-msi`];
	}
	return [];
}

const release = await findReleaseByTag();
const sigAssets = release.assets.filter((a) => a.name.endsWith(".sig"));

const platforms = {};
for (const sig of sigAssets) {
	const bundle = sig.name.slice(0, -4); // strip ".sig"
	const keys = keysFor(bundle);
	if (keys.length === 0) {
		console.log(`• skipped (no updater mapping): ${sig.name}`);
		continue;
	}
	const sigRes = token
		? // Draft assets aren't public: browser_download_url 404s until the
		  // release is published, so fetch via the API (needs the asset id).
		  await fetch(
				`https://api.github.com/repos/${repo}/releases/assets/${sig.id}`,
				{ headers: { ...headers, Accept: "application/octet-stream" } },
			)
		: await fetch(sig.browser_download_url, { headers });
	if (!sigRes.ok) throw new Error(`GET sig ${sig.name} -> ${sigRes.status}`);
	// The .sig file content IS the manifest signature (tauri signs with a
	// base64-encoded minisign payload) — pass it through verbatim, never
	// re-encode it.
	const signature = await sigRes.text();
	for (const key of keys) {
		platforms[key] = { signature, url: downloadUrl(bundle) };
	}
}

const manifest = {
	version: tag.replace(/^v/, ""),
	notes: release.body ?? "",
	pub_date: release.published_at ?? new Date().toISOString(),
	platforms,
};

await writeFile("latest.json", JSON.stringify(manifest, null, 2) + "\n");
const keys = Object.keys(platforms).sort();
console.log(
	`✓ latest.json written — version=${manifest.version} platforms(${keys.length}): ${keys.join(", ")}`,
);
