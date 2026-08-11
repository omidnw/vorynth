import { HistoryService } from "../../src/modules/history/history.service.js";
import { NetworkService } from "../../src/modules/network/network.service.js";
import { createTestDb, type TestDb } from "../helpers/db.js";

/**
 * Network access (v1.8.1 — Settings → Advanced → Developer). Proves the three
 * access modes and the CORS origin allowlist the engine evaluates per request:
 * local (loopback + the app's own origins), all (0.0.0.0, any origin), and
 * custom (0.0.0.0 so the listed IPs can reach the socket, CORS = local +
 * those IPs alongside 127.0.0.1).
 */
describe("NetworkService — developer access modes (v1.8.1)", () => {
	function makeNetwork(): {
		db: TestDb;
		history: HistoryService;
		network: NetworkService;
	} {
		const db = createTestDb();
		const history = new HistoryService(db.service);
		const network = new NetworkService(history);
		return { db, history, network };
	}

	it("defaults to local-only: 127.0.0.1 + the app's own origins", () => {
		const { db, network } = makeNetwork();
		try {
			expect(network.accessMode()).toBe("local");
			expect(network.resolveHost()).toBe("127.0.0.1");

			// The packaged webview + dev server + loopback are always allowed.
			expect(network.isOriginAllowed("tauri://localhost")).toBe(true);
			expect(network.isOriginAllowed("http://tauri.localhost")).toBe(true);
			expect(network.isOriginAllowed("https://tauri.localhost")).toBe(true);
			expect(network.isOriginAllowed("http://localhost:5173")).toBe(true);
			expect(network.isOriginAllowed("http://127.0.0.1:5173")).toBe(true);
			expect(network.isOriginAllowed("http://[::1]:5173")).toBe(true);

			// A LAN device is NOT allowed in local mode.
			expect(network.isOriginAllowed("https://192.168.9.160:3000")).toBe(false);

			// Non-browser requests (no Origin header) are never gated by CORS.
			expect(network.isOriginAllowed(null)).toBe(true);
			expect(network.isOriginAllowed(undefined)).toBe(true);
		} finally {
			db.close();
		}
	});

	it("allow-all (0.0.0.0) reflects any origin", () => {
		const { db, history, network } = makeNetwork();
		try {
			history.setSetting("network.accessMode", "all");

			expect(network.resolveHost()).toBe("0.0.0.0");
			expect(network.isOriginAllowed("https://evil.example")).toBe(true);
			expect(network.isOriginAllowed("http://192.168.9.160:3000")).toBe(true);
		} finally {
			db.close();
		}
	});

	it("custom IPs allow the listed addresses alongside 127.0.0.1", () => {
		const { db, history, network } = makeNetwork();
		try {
			history.setSetting("network.accessMode", "custom");
			history.setSetting("network.allowedIps", "192.168.9.160, 10.0.0.5");

			// 0.0.0.0 so the remote IPs can actually reach the socket…
			expect(network.resolveHost()).toBe("0.0.0.0");
			expect(network.allowedIps()).toEqual(["192.168.9.160", "10.0.0.5"]);

			// …and CORS allows exactly those + the app's own origins.
			expect(network.isOriginAllowed("http://192.168.9.160:3000")).toBe(true);
			expect(network.isOriginAllowed("https://10.0.0.5:8080")).toBe(true);
			expect(network.isOriginAllowed("http://localhost:5173")).toBe(true);
			expect(network.isOriginAllowed("http://192.168.1.99:3000")).toBe(false);
		} finally {
			db.close();
		}
	});

	it("info() reports the resolved view incl. the backend URL and LAN IPs", () => {
		const { db, network } = makeNetwork();
		try {
			network.setPort(34117);
			const info = network.info();
			expect(info.accessMode).toBe("local");
			expect(info.host).toBe("127.0.0.1");
			expect(info.backendUrl).toBe("http://127.0.0.1:34117");
			expect(Array.isArray(info.lanIps)).toBe(true);
		} finally {
			db.close();
		}
	});
});
