/**
 * Bundle the core engine into a single self-contained directory that Tauri
 * ships as a sidecar (project-details.md §15: "The user does not need to
 * install Node.js").
 *
 * `@vercel/ncc` inlines every pure-JS dependency into one `index.js`. Native
 * addons (better-sqlite3) can't be inlined, so we copy the prebuilt `.node`
 * binary next to the bundle.
 *
 * Output goes to dist-bundle/ (NOT dist/) — `nest build` owns dist/ and
 * clobbers it on every typecheck/build, which would wipe our bundle.
 *
 *   dist-bundle/launcher.cjs           CommonJS launcher
 *   dist-bundle/index.js               the inlined engine bundle (ESM)
 *   dist-bundle/better_sqlite3.node    the native binary
 *
 *   node scripts/bundle-sidecar.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, rm, cp, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outDir = join(root, "dist-bundle");

const require = createRequire(import.meta.url);
const nccBin = require.resolve("@vercel/ncc/dist/ncc/cli.js");
const entry = join(root, "src", "main.ts");

console.log("▶ bundling core engine sidecar → dist-bundle/");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

// 1. Build the workspace types package so its dist/ exists. ncc needs to
//    resolve @vorynth/types to compiled JS — pointing it at .ts source makes
//    ncc try to compile the workspace package and trip TS6059 (rootDir).
console.log("▶ building @vorynth/types");
await run("pnpm", ["--filter", "@vorynth/types", "build"]);

// 2. Inline all pure-JS deps into a single bundle. better-sqlite3's
//    JavaScript wrapper is inlined; only the native .node binary is kept
//    separate (copied in step 3 below). The --external flag is intentionally
//    NOT used for better-sqlite3 — externalising it would leave a bare
//    `import "better-sqlite3"` in the ESM output that Node cannot resolve
//    when the bundle is deployed without a node_modules tree.
await run(nccBin, [
	"build",
	entry,
	"--target",
	"es2022",
	"--no-source-map-register",
	"-o",
	outDir,
]);
console.log("• ncc produced dist-bundle/index.js");

// Pick the largest emitted .js (the real bundle) in case ncc names it
// differently across versions.
const files = await readdir(outDir);
const jsFiles = files.filter((f) => f.endsWith(".js"));
let bundleName = "index.js";
let biggest = 0;
for (const f of jsFiles) {
	const stat = await readFile(join(outDir, f));
	if (stat.length > biggest) {
		biggest = stat.length;
		bundleName = f;
	}
}
console.log(`• identified bundle: ${bundleName} (${Math.round(biggest / 1024)} KB)`);

// 2. Copy the prebuilt better-sqlite3 native binary.
const nativeCandidates = [
	join(root, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node"),
	join(root, "node_modules", "better-sqlite3", "build", "Debug", "better_sqlite3.node"),
];
const nativePath = nativeCandidates.find((p) => existsSync(p));
if (nativePath) {
	await cp(nativePath, join(outDir, "better_sqlite3.node"));
	console.log("• copied better_sqlite3.node");
} else {
	console.warn("⚠ better-sqlite3 native binary not found — bundle won't run until built");
}

// 3. Drop ncc's package.json so it can't shadow the launcher's CommonJS form.
const distPkg = join(outDir, "package.json");
if (existsSync(distPkg)) await rm(distPkg, { force: true });

// 4. CommonJS launcher (gives us __dirname + require for the native addon).
const launcher = [
	"// Launcher for the bundled Vorynth core engine sidecar.",
	"// Run with: node dist-bundle/launcher.cjs [--port N]",
	"'use strict';",
	"const path = require('path');",
	"const fs = require('fs');",
	"",
	"// Point better-sqlite3 at the bundled native binary so it doesn't try to",
	"// resolve through node_modules (which doesn't exist in the bundled dir).",
	"const nativeBinary = path.join(__dirname, 'better_sqlite3.node');",
	"if (fs.existsSync(nativeBinary)) {",
	"  process.env.BETTER_SQLITE3_BINARY = path.dirname(nativeBinary);",
	"}",
	"",
	"// Hand off to the ESM bundle.",
	"const bundle = path.join(__dirname, " + JSON.stringify(bundleName) + ");",
	"import(bundle).catch((err) => {",
	"  console.error('Vorynth core failed to start:', err);",
	"  process.exit(1);",
	"});",
].join("\n");
await writeFile(join(outDir, "launcher.cjs"), launcher, "utf8");
console.log("• wrote dist-bundle/launcher.cjs");

// 5. A package.json with "type": "module" so the ESM bundle is loaded
//    without a redundant reparse (launcher.cjs uses the .cjs extension and
//    is therefore unaffected by this field).
await writeFile(
	join(outDir, "package.json"),
	JSON.stringify(
		{
			name: "vorynth-core-sidecar",
			version: "1.0.0",
			private: true,
			type: "module",
		},
		null,
		2,
	),
	"utf8",
);

console.log("✓ bundle complete → dist-bundle/");
console.log("  run with:  node dist-bundle/launcher.cjs --port 4399");

function run(cmd, args) {
	return new Promise((resolve, reject) => {
		const isWin = process.platform === "win32";
		// On Windows, .cmd/.bat wrappers (pnpm, npm) need a shell to execute
		// their batch file. Node 24+ deprecates array args with shell:true —
		// concatenate the full command string instead.
		const child = isWin
			? spawn(
					`${cmd} ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ")}`,
					{ stdio: "inherit", shell: true },
				)
			: spawn(cmd, args, { stdio: "inherit" });
		child.on("close", (code) =>
			code === 0 ? resolve(undefined) : reject(new Error(`${cmd} exited ${code}`)),
		);
		child.on("error", reject);
	});
}
