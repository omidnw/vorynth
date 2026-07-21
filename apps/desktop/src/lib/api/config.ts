import type { ApiError } from "@vorynth/types";

/**
 * Engine base URL.
 *
 * In dev the engine runs on a fixed port (4317). In the packaged Tauri app the
 * Rust shell picks a free port when spawning the sidecar and exposes it to the
 * webview via `__VORYNTH_CORE_PORT__` (injected before the bundle loads).
 */
function readPort(): number {
	const injected = (globalThis as unknown as { __VORYNTH_CORE_PORT__?: number })
		.__VORYNTH_CORE_PORT__;
	if (typeof injected === "number" && injected > 0) return injected;
	return Number(import.meta.env.VITE_CORE_PORT ?? 4317);
}

export const CORE_HOST = import.meta.env.VITE_CORE_HOST ?? "127.0.0.1";
export const CORE_PORT = readPort();
export const CORE_BASE_URL = `http://${CORE_HOST}:${CORE_PORT}`;

export class ApiException extends Error {
	constructor(
		public readonly status: number,
		message: string,
		public readonly details?: unknown,
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
	const res = await fetch(`${CORE_BASE_URL}${path}`, {
		...init,
		headers: {
			"Content-Type": "application/json",
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
		);
	}
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}
