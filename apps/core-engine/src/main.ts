import { NestFactory } from "@nestjs/core";
import {
	FastifyAdapter,
	type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger, ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module.js";
import { resolvePort } from "./common/runtime/port.js";

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
	const host = process.env.HOST ?? "127.0.0.1";

	const app = await NestFactory.create<NestFastifyApplication>(
		AppModule,
		new FastifyAdapter({
			logger: false,
			// SSE endpoints keep the underlying socket open indefinitely.
			keepAliveTimeout: 0,
			bodyLimit: 4 * 1024 * 1024,
		}),
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
	app.enableCors({
		origin: true, // local-only engine — any origin is safe
		methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "Accept"],
	});

	await app.listen(port, host, () => {
		logger.log(`Vorynth Core Engine listening on http://${host}:${port}`);
		logger.log(`Health check → http://${host}:${port}/health`);
	});
}

bootstrap().catch((err) => {
	console.error("Fatal: failed to start Vorynth Core Engine", err);
	process.exit(1);
});
