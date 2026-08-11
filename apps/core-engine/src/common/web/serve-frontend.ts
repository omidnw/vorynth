import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { LoggerService } from "@nestjs/common";

/**
 * v1.8.1 — serve the built desktop frontend over HTTP, so the Developer
 * section can advertise a usable frontend URL (http://ip:port, exactly like
 * the backend) instead of the webview-only `tauri://…` origin.
 *
 * The Tauri webview keeps loading its BUNDLED assets — this is an ADDITIONAL
 * path for browsers and devices on the network. Registered AFTER the Nest
 * routes so every API route wins; the SPA fallback only answers browser
 * navigations (Accept: text/html), so API 404s stay JSON.
 */

const MIME: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json",
	".svg": "image/svg+xml",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".ico": "image/x-icon",
	".map": "application/json",
};

/** The bundle's own directory (the ncc output runs as ESM — no __dirname). */
const MODULE_DIR = fileURLToPath(new URL(".", import.meta.url));

/**
 * Locate the built frontend, or null when no build exists (a dev engine run
 * without `vite build` first). Priority:
 *   1. VORYNTH_WEB_DIR env override.
 *   2. `<sidecar dir>/web` — the packaged app stages the dist next to the
 *      engine binary (src-tauri/binaries/…/web), shipped via bundle.resources.
 *   3. `<cwd>/../desktop/dist` — dev, when the engine runs from apps/core-engine.
 */
export function resolveWebRoot(): string | null {
	const candidates = [
		process.env.VORYNTH_WEB_DIR,
		// The launcher (CJS) sets this to its own dir — the packaged web build
		// is staged next to the engine binary as <sidecar dir>/web.
		process.env.VORYNTH_SIDECAR_DIR
			? join(process.env.VORYNTH_SIDECAR_DIR, "web")
			: null,
		join(MODULE_DIR, "web"),
		resolve(process.cwd(), "../desktop/dist"),
	].filter((p): p is string => Boolean(p));
	for (const dir of candidates) {
		if (existsSync(join(dir, "index.html"))) return dir;
	}
	return null;
}

/** Serve the built frontend from the engine's HTTP root (v1.8.1). */
export function registerWebServing(
	fastify: FastifyInstance,
	logger: LoggerService,
): void {
	const webRoot = resolveWebRoot();
	if (!webRoot) {
		logger.warn(
			"web serving: no frontend build found — the Developer frontend URL stays API-only",
		);
		return;
	}
	logger.log(`web serving: frontend at ${webRoot}`);

	const sendFile = (reply: FastifyReply, rel: string) => {
		// Normalize + reject traversal — never serve outside the build dir.
		const relPath = normalize(rel);
		if (relPath === ".." || relPath.startsWith(`..${sep}`)) {
			return reply.code(404).send("Not found");
		}
		const file = join(webRoot, relPath);
		if (
			!file.startsWith(webRoot + sep) ||
			!existsSync(file) ||
			!statSync(file).isFile()
		) {
			return reply.code(404).send("Not found");
		}
		reply.type(MIME[extname(file).toLowerCase()] ?? "application/octet-stream");
		// Fastify async handlers must RETURN the reply for streams — the file
		// content is piped by Fastify itself.
		return reply.send(createReadStream(file));
	};

	// The entry HTML + the asset dirs the built index.html references. These
	// exact prefixes never collide with API routes (registered after Nest).
	fastify.get("/", async (_req, reply) => sendFile(reply, "index.html"));
	fastify.get("/index.html", async (_req, reply) =>
		sendFile(reply, "index.html"),
	);
	fastify.get("/assets/*", async (req, reply) =>
		sendFile(reply, join("assets", (req.params as { "*": string })["*"])),
	);
	fastify.get("/plugins/icons/*", async (req, reply) =>
		sendFile(
			reply,
			join("plugins", "icons", (req.params as { "*": string })["*"]),
		),
	);

	// SPA fallback: browser navigations (e.g. /brief, /archive) get index.html;
	// anything else (an API miss) keeps a JSON 404. A low-priority `/*` GET
	// route rather than setNotFoundHandler — Nest registers ITS OWN notFound
	// handler during init, and Fastify allows only one per prefix.
	fastify.get("/*", async (req: FastifyRequest, reply: FastifyReply) => {
		const accept = String(req.headers.accept ?? "");
		if (accept.includes("text/html")) {
			return sendFile(reply, "index.html");
		}
		return reply.code(404).send({ statusCode: 404, message: "Not Found" });
	});
}
