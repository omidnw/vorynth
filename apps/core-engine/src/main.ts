import { NestFactory } from "@nestjs/core";
import {
	FastifyAdapter,
	type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module.js";
import { resolvePort } from "./common/runtime/port.js";
import { NetworkService } from "./modules/network/network.service.js";
import { registerWebServing } from "./common/web/serve-frontend.js";

/**
 * Core Engine bootstrap.
 *
 * Runs as a long-lived HTTP (Fastify) server. In dev it binds a fixed PORT
 * from env; in the packaged app, Tauri spawns this binary with `--port <free>`
 * so the webview can point at it without colliding with anything else on the
 * machine. The user never installs Node — the engine ships as a single
 * executable (Node SEA / ncc bundle) declared as a Tauri sidecar.
 */
async function bootstrap() {
	const logger = new Logger("VorynthCore");

	const port = await resolvePort(process.env, process.argv);

	const fastify = new FastifyAdapter({
		logger: false,
		// SSE endpoints keep the underlying socket open indefinitely.
		keepAliveTimeout: 0,
		bodyLimit: 4 * 1024 * 1024,
	});
	// Fastify has no default parser for application/octet-stream — the
	// .vorynth-plugin install endpoint uploads its file bytes with that type
	// and needs the raw Buffer (parseAs: "buffer"), still capped by bodyLimit.
	fastify
		.getInstance()
		.addContentTypeParser(
			"application/octet-stream",
			{ parseAs: "buffer" },
			(_req, body, done) => done(null, body),
		);

	const app = await NestFactory.create<NestFastifyApplication>(
		AppModule,
		fastify,
		{ bufferLogs: true },
	);

	app.enableShutdownHooks();
	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			transform: true,
			forbidNonWhitelisted: true,
		}),
	);

	// v1.8.1 — network access: the host is resolved from the Developer settings
	// (loopback by default; 0.0.0.0 when the user opens the engine to the
	// network). Env HOST still overrides. The CORS origin callback reads the
	// LIVE settings per request, so access-mode / allowlist changes apply
	// immediately; the listening host applies on the next launch.
	const network = app.get(NetworkService);
	network.setPort(port);
	const host = process.env.HOST ?? network.resolveHost();

	app.enableCors({
		// The engine is a local service with no login: CORS guards browser
		// cross-origin requests only (curl/scripts are never gated), per the
		// access mode the user chose in Settings → Advanced → Developer.
		origin: (origin, cb) => cb(null, network.isOriginAllowed(origin)),
		methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "Accept"],
	});

	// v1.8.1 — serve the built frontend at the engine's root so the Developer
	// section's frontend URL is a real http://ip:port address. Registered AFTER
	// the Nest routes (API wins); see serve-frontend.ts.
	registerWebServing(app.getHttpAdapter().getInstance(), logger);

	await app.listen(port, host, () => {
		logger.log(`Vorynth Core Engine listening on http://${host}:${port}`);
		logger.log(`Health check → http://${host}:${port}/health`);
	});
}

bootstrap().catch((err) => {
	console.error("Fatal: failed to start Vorynth Core Engine", err);
	process.exit(1);
});
