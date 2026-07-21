/**
 * Resolves the port the engine should bind to.
 *
 * Priority:
 *   1. `--port <n>` CLI flag (this is how Tauri passes its chosen free port
 *      to the bundled sidecar in production).
 *   2. `PORT` env var (dev convenience).
 *   3. Fallback 4317.
 *
 * In production we rely on Tauri to hand us a free port so the sidecar never
 * collides with other local services.
 */
export async function resolvePort(
	env: NodeJS.ProcessEnv,
	argv: string[],
): Promise<number> {
	const fromFlag = parsePortFlag(argv);
	if (fromFlag !== null) return fromFlag;

	const fromEnv = env.PORT ? Number.parseInt(env.PORT, 10) : Number.NaN;
	if (Number.isFinite(fromEnv) && fromEnv > 0 && fromEnv < 65536) {
		return fromEnv;
	}

	return 4317;
}

function parsePortFlag(argv: string[]): number | null {
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--port" && i + 1 < argv.length) {
			const n = Number.parseInt(argv[i + 1] ?? "", 10);
			if (Number.isFinite(n) && n > 0 && n < 65536) return n;
		}
		if (a !== undefined && a.startsWith("--port=")) {
			const n = Number.parseInt(a.slice("--port=".length), 10);
			if (Number.isFinite(n) && n > 0 && n < 65536) return n;
		}
	}
	return null;
}
