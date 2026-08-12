import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the site under /vorynth/ — the Pages workflow sets
// VITE_BASE_URL. Locally (dev / preview) it defaults to "/".
const base = process.env.VITE_BASE_URL || "/";

// Single source of truth for the version inside the landing's JSON-LD: read it
// straight from packages/types (same constant the rest of the repo ships), so
// the structured data can never drift from a release.
const VORYNTH_VERSION = (() => {
	try {
		const p = fileURLToPath(
			new URL("../../packages/types/src/index.ts", import.meta.url),
		);
		const m = readFileSync(p, "utf8").match(
			/VORYNTH_VERSION\s*=\s*"(\d+\.\d+\.\d+)"/,
		);
		return m?.[1] ?? "1.8.2";
	} catch {
		return "1.8.2";
	}
})();

const SITE_URL = "https://omidnw.github.io/vorynth";
const SEO_PAGES = [
	{ path: "", changefreq: "weekly", priority: "1.0" },
	{ path: "personal-intelligence/", changefreq: "monthly", priority: "0.9" },
	{ path: "ai-news-reader/", changefreq: "monthly", priority: "0.8" },
	{ path: "local-first/", changefreq: "monthly", priority: "0.8" },
	{ path: "rss-reader/", changefreq: "monthly", priority: "0.8" },
	{ path: "open-source/", changefreq: "monthly", priority: "0.8" },
	{ path: "screenshots/", changefreq: "monthly", priority: "0.7" },
	{ path: "changelog/", changefreq: "monthly", priority: "0.7" },
	{ path: "roadmap/", changefreq: "monthly", priority: "0.7" },
	{ path: "sources/developer/", changefreq: "monthly", priority: "0.8" },
	{ path: "sources/kubernetes/", changefreq: "monthly", priority: "0.8" },
	{ path: "sources/security/", changefreq: "monthly", priority: "0.8" },
];

/**
 * Landing SEO:
 *  - injects the real VORYNTH_VERSION into the index.html JSON-LD, and
 *  - emits sitemap.xml (build-date lastmod) into the output so it always
 *    reflects the pages that actually ship.
 */
function seoPlugin(): Plugin {
	// emitFile only exists in real builds — serve/test mode has no output dir,
	// so the sitemap is produced exclusively by `vite build`.
	let command: "build" | "serve" = "serve";
	return {
		name: "vorynth-seo",
		configResolved(config) {
			command = config.command;
		},
		transformIndexHtml(html) {
			return html.replaceAll("__VORYNTH_VERSION__", VORYNTH_VERSION);
		},
		buildEnd() {
			if (command !== "build") return;
			const today = new Date().toISOString().slice(0, 10);
			const urls = SEO_PAGES.map(
				(p) =>
					`\t<url>\n\t\t<loc>${SITE_URL}/${p.path}</loc>\n\t\t<lastmod>${today}</lastmod>\n\t\t<changefreq>${p.changefreq}</changefreq>\n\t\t<priority>${p.priority}</priority>\n\t</url>`,
			).join("\n");
			const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
			this.emitFile({ type: "asset", fileName: "sitemap.xml", source: xml });
		},
	};
}

export default defineConfig({
	plugins: [react(), seoPlugin()],
	base,
	server: {
		// Distinct from the desktop dev server (5173) so `pnpm dev:landing` and
		// `pnpm dev:desktop` can run side by side.
		port: 5174,
		strictPort: true,
	},
	resolve: {
		alias: {
			// The real desktop app source — the preview renders the actual
			// ShellLayout + BriefPage screens. Only the engine API is mocked
			// (see src/mock-engine.ts).
			"@": fileURLToPath(new URL("../desktop/src", import.meta.url)),
		},
	},
	build: {
		// One entry per real page. GitHub Pages serves directory index files, so
		// changelog/index.html → /vorynth/changelog/, sources/developer/index.html
		// → /vorynth/sources/developer/ — every page gets its own crawlable URL
		// with its own <title>/meta instead of one SPA document.
		rollupOptions: {
			input: {
				home: fileURLToPath(new URL("./index.html", import.meta.url)),
				"personal-intelligence": fileURLToPath(
					new URL("./personal-intelligence/index.html", import.meta.url),
				),
				"ai-news-reader": fileURLToPath(
					new URL("./ai-news-reader/index.html", import.meta.url),
				),
				"local-first": fileURLToPath(
					new URL("./local-first/index.html", import.meta.url),
				),
				"rss-reader": fileURLToPath(
					new URL("./rss-reader/index.html", import.meta.url),
				),
				"open-source": fileURLToPath(
					new URL("./open-source/index.html", import.meta.url),
				),
				screenshots: fileURLToPath(
					new URL("./screenshots/index.html", import.meta.url),
				),
				changelog: fileURLToPath(
					new URL("./changelog/index.html", import.meta.url),
				),
				roadmap: fileURLToPath(
					new URL("./roadmap/index.html", import.meta.url),
				),
				"sources/developer": fileURLToPath(
					new URL("./sources/developer/index.html", import.meta.url),
				),
				"sources/kubernetes": fileURLToPath(
					new URL("./sources/kubernetes/index.html", import.meta.url),
				),
				"sources/security": fileURLToPath(
					new URL("./sources/security/index.html", import.meta.url),
				),
			},
			output: {
				// Split the heavy vendors out of the page chunks so the React shell
				// is cached across pages and the markdown stack loads only on the
				// roadmap page.
				manualChunks(id) {
					if (!id.includes("node_modules")) return undefined;
					if (/[\\/]react(-dom)?[\\/]|[\\/]scheduler[\\/]/.test(id))
						return "vendor-react";
					if (/react-router|history[\\/]/.test(id)) return "vendor-router";
					if (
						/react-markdown|remark|unified|unist|mdast|micromark|hast|vfile/.test(
							id,
						)
					)
						return "vendor-markdown";
					return undefined;
				},
			},
		},
		// The preview embeds the real desktop UI, so the home chunk stays large;
		// keep the warning threshold honest instead of hiding a real problem.
		chunkSizeWarningLimit: 900,
	},
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test-setup.ts"],
	},
});
