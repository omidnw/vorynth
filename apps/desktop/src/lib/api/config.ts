import type { ApiError } from "@vorynth/types";

/**
 * Engine base URL.
 *
 * The Rust shell uses a fixed port (34117) unless it is already taken, then
 * it falls back to an OS-assigned port. The init-script and URL-param paths
 * below cover that fallback; in the common case 34117 "just works" on both
 * sides without any runtime communication.
 */
const FIXED_PORT = 34117;

function readPort(): number {
	// 1. URL query param `__vp` (set by Rust when the fixed port is busy).
	const params = new URLSearchParams(
		typeof window !== "undefined" ? window.location.search : "",
	);
	const fromUrl = params.get("__vp");
	if (fromUrl) {
		const n = Number(fromUrl);
		if (Number.isFinite(n) && n > 0) return n;
	}

	// 2. Tauri init-script injection (legacy — kept for safety).
	const injected = (globalThis as unknown as { __VORYNTH_CORE_PORT__?: number })
		.__VORYNTH_CORE_PORT__;
	if (typeof injected === "number" && injected > 0) return injected;

	// 3. Fixed port (the common path — no runtime overhead).
	return FIXED_PORT;
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
