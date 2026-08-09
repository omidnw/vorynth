import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

/**
 * "has history" detection (v1.9.0).
 *
 * The old `location.key !== "default"` check was unreliable: a browser reload
 * of a page reached through in-app navigation preserves `history.state` (with
 * its real uuid key), so `/plugins` reloaded directly still showed a back
 * button while `/plugins/` (fresh state → "default") hid it. The fix records
 * the app's FIRST location key and compares every later key against it, so
 * "did the user navigate here from inside the app?" no longer depends on URL
 * spelling.
 */

// Re-import the module under test in every test so its module-level `initialKey`
// starts fresh (jest.resetModules + fresh import).
async function freshModule() {
	vi.resetModules();
	return await import("./has-history.js");
}

describe("locationHasHistory / captureInitialLocationKey", () => {
	it("reports no history for the initial (deep-link) location — trailing slash", async () => {
		const { captureInitialLocationKey, locationHasHistory } =
			await freshModule();
		captureInitialLocationKey("k-plugins-slash");
		expect(locationHasHistory("k-plugins-slash")).toBe(false);
	});

	it("reports no history for the initial (deep-link) location — no trailing slash", async () => {
		const { captureInitialLocationKey, locationHasHistory } =
			await freshModule();
		captureInitialLocationKey("k-plugins");
		expect(locationHasHistory("k-plugins")).toBe(false);
	});

	it("reports history once the user navigates to a different location", async () => {
		const { captureInitialLocationKey, locationHasHistory } =
			await freshModule();
		captureInitialLocationKey("k-initial");
		expect(locationHasHistory("k-navigated")).toBe(true);
	});

	it("keeps the first key after a page remount (back + forward)", async () => {
		const { captureInitialLocationKey, locationHasHistory } =
			await freshModule();
		captureInitialLocationKey("k-initial");
		captureInitialLocationKey("k-initial"); // remount — first still wins
		expect(locationHasHistory("k-initial")).toBe(false);
	});
});

describe("useHasHistory", () => {
	async function renderAt(path: string) {
		const { captureInitialLocationKey, useHasHistory } = await freshModule();

		function Probe() {
			const location = useLocation();
			captureInitialLocationKey(location.key);
			return <div>{useHasHistory() ? "HAS-HISTORY" : "NO-HISTORY"}</div>;
		}

		render(
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route path="/plugins" element={<Probe />} />
				</Routes>
			</MemoryRouter>,
		);
		return screen.getByText(/HAS-HISTORY|NO-HISTORY/).textContent;
	}

	beforeEach(() => {
		vi.resetModules();
	});

	it("is false on a direct load of /plugins (no back button)", async () => {
		expect(await renderAt("/plugins")).toBe("NO-HISTORY");
	});

	it("is false on a direct load of /plugins/ with a trailing slash", async () => {
		expect(await renderAt("/plugins/")).toBe("NO-HISTORY");
	});
});
