import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

/**
 * Engine base URL resolution (v1.8.0): the Tauri shell picks a free port at
 * launch (34117 by default; a higher one when 34117 is taken) and the frontend
 * discovers it before the first render — via the `engine_port` IPC command in
 * the packaged app, then the fixed port, then an upward `/health` probe.
 * Browser dev always lands on the fixed port.
 */

/** Stub fetch so only the listed ports answer /health; everything else fails. */
function stubHealth(okPorts: number[]) {
	return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
		const url = typeof input === "string" ? input : (input as Request).url;
		const m = url.match(/127\.0\.0\.1:(\d+)\/health/);
		const port = m ? Number(m[1]) : 0;
		if (okPorts.includes(port)) {
			return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
		}
		throw new TypeError("fetch failed");
	});
}

async function freshConfig() {
	vi.resetModules();
	return import("./config.js");
}

describe("initCoreBaseUrl (engine port discovery)", () => {
	beforeEach(() => {
		mocks.invoke.mockReset();
		delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
	});

	it("uses the fixed port when its /health responds (dev / free fixed port)", async () => {
		const fetchMock = stubHealth([34117]);
		try {
			const mod = await freshConfig();
			await mod.initCoreBaseUrl();
			expect(mod.CORE_BASE_URL).toContain("34117");
			expect(mocks.invoke).not.toHaveBeenCalled();
		} finally {
			fetchMock.mockRestore();
		}
	});

	it("prefers the engine_port IPC result inside the Tauri shell", async () => {
		(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
		mocks.invoke.mockResolvedValue(34200);
		const fetchMock = stubHealth([34200]);
		try {
			const mod = await freshConfig();
			await mod.initCoreBaseUrl();
			expect(mocks.invoke).toHaveBeenCalledWith("engine_port");
			expect(mod.CORE_BASE_URL).toContain("34200");
		} finally {
			fetchMock.mockRestore();
		}
	});

	it("falls back to the fixed port when the IPC call fails", async () => {
		(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
		mocks.invoke.mockRejectedValue(new Error("no engine"));
		const fetchMock = stubHealth([34117]);
		try {
			const mod = await freshConfig();
			await mod.initCoreBaseUrl();
			expect(mod.CORE_BASE_URL).toContain("34117");
		} finally {
			fetchMock.mockRestore();
		}
	});

	it("probes upward when the fixed port is busy with a non-engine", async () => {
		// No Tauri (e.g. IPC unavailable): 34117 is dead, the engine sits on 34119.
		const fetchMock = stubHealth([34119]);
		try {
			const mod = await freshConfig();
			await mod.initCoreBaseUrl();
			expect(mod.CORE_BASE_URL).toContain("34119");
		} finally {
			fetchMock.mockRestore();
		}
	});

	it("apiFetch targets the discovered port", async () => {
		(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
		mocks.invoke.mockResolvedValue(34200);
		const healthOk = new URL("http://127.0.0.1:34200/health").toString();
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = typeof input === "string" ? input : (input as Request).url;
				if (url === healthOk) {
					return new Response(JSON.stringify({ status: "ok" }), {
						status: 200,
					});
				}
				return new Response(JSON.stringify({ ok: true }), { status: 200 });
			});
		try {
			const { apiFetch } = await freshConfig();
			await apiFetch("/jobs");
			expect(fetchMock).toHaveBeenCalledWith(
				"http://127.0.0.1:34200/jobs",
				expect.anything(),
			);
		} finally {
			fetchMock.mockRestore();
		}
	});
});
