import { Inject, Injectable } from "@nestjs/common";
import { networkInterfaces } from "node:os";
import { HistoryService } from "../history/history.service.js";

export type NetworkAccessMode = "local" | "all" | "custom";

/** Origins that are always allowed (the app itself, dev server, loopback). */
const LOCAL_ORIGIN_HOSTNAMES = new Set([
	"localhost",
	"127.0.0.1",
	"::1",
	"tauri.localhost",
]);

/**
 * Engine network access (v1.8.1 — Settings → Advanced → Developer).
 *
 * Three modes, stored as app_settings:
 * - `local`  (default): listen on 127.0.0.1, CORS only for local origins
 *   (the packaged webview, the dev server, loopback).
 * - `all`:    listen on 0.0.0.0, CORS reflects any origin — the engine is
 *   reachable from every device on the network.
 * - `custom`: listen on 0.0.0.0 (so the listed IPs can actually reach the
 *   socket) but CORS only for local origins + the exact IPs the user typed
 *   (e.g. "192.168.9.160,10.0.0.5") — those are allowed alongside 127.0.0.1.
 *
 * CORS is evaluated per request by reading the live settings, so origin
 * changes apply immediately. The listening HOST is read at startup (main.ts)
 * and applies on the next launch — rebinding a live Fastify listener is not
 * safe with the engine's keep-alive SSE sockets.
 *
 * Security: the engine has no login. Browsers are gated by CORS, but any
 * non-browser client on the network (curl, scripts) is NOT — so "all" and
 * "custom" expose the HTTP API to your network. The UI warns about this.
 */
@Injectable()
export class NetworkService {
	private port = 34117;

	constructor(
		@Inject(HistoryService) private readonly settings: HistoryService,
	) {}

	/** main.ts hands over the resolved port so GET /network can report it. */
	setPort(port: number): void {
		this.port = port;
	}

	accessMode(): NetworkAccessMode {
		const mode = this.settings.getSetting<unknown>(
			"network.accessMode",
			"local",
		);
		return mode === "all" || mode === "custom" ? mode : "local";
	}

	/** The allowlisted IPs from `network.allowedIps` (comma-separated). */
	allowedIps(): string[] {
		const raw = this.settings.getSetting<string>("network.allowedIps", "");
		return raw
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	}

	/** The host the engine should listen on. Loopback only in "local" mode;
	 *  every interface in "all"/"custom" (remote IPs need the socket open). */
	resolveHost(): string {
		return this.accessMode() === "local" ? "127.0.0.1" : "0.0.0.0";
	}

	/** Detected LAN IPv4s — for the Developer "reachable at" display. */
	lanIps(): string[] {
		const out: string[] = [];
		for (const ifaces of Object.values(networkInterfaces())) {
			for (const iface of ifaces ?? []) {
				if (iface.family === "IPv4" && !iface.internal) out.push(iface.address);
			}
		}
		return out;
	}

	/**
	 * Whether a browser origin may call the engine. Evaluated per request by
	 * the CORS origin callback. A missing Origin (curl, scripts, same-origin
	 * navigations) is never gated — CORS only guards browser cross-origin
	 * requests.
	 */
	isOriginAllowed(origin: string | null | undefined): boolean {
		if (!origin) return true;
		const mode = this.accessMode();
		if (mode === "all") return true;
		if (isLocalOrigin(origin)) return true;
		if (mode === "custom") {
			return this.allowedIps().includes(originHostname(origin));
		}
		return false;
	}

	/** Payload for GET /network — the Developer settings display. */
	info(): {
		accessMode: NetworkAccessMode;
		allowedIps: string[];
		host: string;
		port: number;
		lanIps: string[];
		backendUrl: string;
	} {
		return {
			accessMode: this.accessMode(),
			allowedIps: this.allowedIps(),
			host: this.resolveHost(),
			port: this.port,
			lanIps: this.lanIps(),
			backendUrl: `http://127.0.0.1:${this.port}`,
		};
	}
}

function originHostname(origin: string): string {
	try {
		return new URL(origin).hostname;
	} catch {
		// Non-URL-ish origins (rare) — fall back to the authority part.
		const m = origin.match(/^(?:[a-z][a-z0-9+.-]*:)?\/\/([^/:]+)/i);
		return m?.[1] ?? origin;
	}
}

/** The app's own origins — the packaged webview (tauri://localhost /
 *  http(s)://tauri.localhost), the dev server, and loopback, any port. */
function isLocalOrigin(origin: string): boolean {
	const host = originHostname(origin)
		.toLowerCase()
		.replace(/^\[|\]$/g, "");
	return LOCAL_ORIGIN_HOSTNAMES.has(host);
}
