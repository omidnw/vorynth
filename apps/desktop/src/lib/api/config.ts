import type { ApiError } from "@vorynth/types";

/**
 * Engine base URL.
 *
 * The Rust shell picks a free port for the engine at launch (34117 by default;
 * a higher one when 34117 is taken — dev engine, a second instance, any local
 * process). The frontend discovers it in `initCoreBaseUrl()` before the first
 * render, in order:
 *
 *   1. Tauri IPC `engine_port` (authoritative in the packaged app).
 *   2. The fixed port 34117 (dev: the dev engine is always there).
 *   3. A short upward probe of `/health` (covers a busy fixed port when the
 *      IPC path is unavailable) — plain HTTP, works in any environment.
 *
 * The resolved port is written into `CORE_BASE_URL`, which every consumer
 * reads after `main.tsx` awaits `initCoreBaseUrl()`.
 */
const FIXED_PORT = 34117;
/** How many ports to probe upward before giving up on finding the engine. */
const PORT_PROBE_LIMIT = 50;
/** Per-port /health timeout during the probe (fast for a responding engine). */
const HEALTH_TIMEOUT_MS = 400;
/** Upper bound on the engine_port IPC call — a hung invoke must not stall
 *  discovery (the native side occasionally never answers). */
const IPC_TIMEOUT_MS = 2500;

/** True when the local engine responds on this port. */
async function healthOk(port: number): Promise<boolean> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
	try {
		const res = await fetch(`http://127.0.0.1:${port}/health`, {
			signal: ctrl.signal,
		});
		return res.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}

/** Tauri IPC port (0 when unavailable/failed/timed out). A hanging invoke must
 *  never block discovery — the IPC promise can stay pending forever if the
 *  native side never responds, so it is bounded by a timeout. */
async function ipcEnginePort(): Promise<number> {
	const isTauri =
		typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
	if (!isTauri) return 0;
	try {
		const { invoke } = await import("@tauri-apps/api/core");
		const p = await withTimeout(invoke<number>("engine_port"), IPC_TIMEOUT_MS);
		return typeof p === "number" && p > 0 ? p : 0;
	} catch {
		return 0;
	}
}

/** Race a promise against a timeout — rejects when `ms` elapses first. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("timed out")), ms);
		promise.then(
			(v) => {
				clearTimeout(timer);
				resolve(v);
			},
			(e) => {
				clearTimeout(timer);
				reject(e);
			},
		);
	});
}

async function findEnginePort(): Promise<number> {
	// 1. Tauri IPC — the shell's chosen port; verify it's actually the engine.
	const ipc = await ipcEnginePort();
	if (ipc > 0 && (await healthOk(ipc))) return ipc;

	// 2. The fixed port — the common dev/packaged case.
	if (await healthOk(FIXED_PORT)) return FIXED_PORT;

	// 3. Upward probe — the fixed port is busy with something else; the engine
	//    sits on the next free port the shell picked.
	for (let p = FIXED_PORT + 1; p < FIXED_PORT + PORT_PROBE_LIMIT; p++) {
		if (await healthOk(p)) return p;
	}

	return FIXED_PORT;
}

export const CORE_HOST = import.meta.env.VITE_CORE_HOST ?? "127.0.0.1";

/** Sync base URL — correct in dev; upgraded to the discovered port in the
 *  packaged app once `initCoreBaseUrl()` resolves. */
export let CORE_BASE_URL = `http://${CORE_HOST}:${FIXED_PORT}`;

let resolving: Promise<string> | null = null;

/**
 * Discover the engine base URL once and upgrade `CORE_BASE_URL` in place.
 * Call in `main.tsx` before rendering. Idempotent — later callers (e.g.
 * `apiFetch`) get the cached promise.
 */
export function initCoreBaseUrl(): Promise<string> {
	if (!resolving) {
		resolving = findEnginePort().then((port) => {
			CORE_BASE_URL = `http://${CORE_HOST}:${port}`;
			return CORE_BASE_URL;
		});
	}
	return resolving;
}

export class ApiException extends Error {
	constructor(
		public readonly status: number,
		message: string,
		public readonly details?: unknown,
		/** Structured engine error code (e.g. `LLM_RATE_LIMITED`) when the
		 *  engine sent one in the error body. */
		public readonly code?: string,
	) {
		super(message);
		this.name = "ApiException";
	}
}

/** Thin fetch wrapper that normalizes errors into `ApiException`. */
export async function apiFetch<T>(
	path: string,
	init?: RequestInit,
): Promise<T> {
	const base = await initCoreBaseUrl();
	const res = await fetch(`${base}${path}`, {
		...init,
		headers: {
			...(init?.body ? { "Content-Type": "application/json" } : {}),
			...(init?.headers ?? {}),
		},
	});
	if (!res.ok) {
		let body: ApiError | null = null;
		try {
			body = (await res.json()) as ApiError;
		} catch {
			// non-JSON error
		}
		throw new ApiException(
			res.status,
			body?.message ?? res.statusText,
			body?.details,
			body?.code,
		);
	}
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}
