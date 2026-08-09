import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { installMockEngine } from "./mock-engine";

// Vitest runs without `globals: true`, so Testing Library's auto-cleanup is
// not registered — without this, a second `render()` in a test file would
// see the previous test's DOM and "find multiple elements".
afterEach(cleanup);

// jsdom has no matchMedia (used by the theme hook) — provide a no-op.
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		addListener: vi.fn(),
		removeListener: vi.fn(),
		dispatchEvent: vi.fn(),
	}),
});

// The preview renders the real desktop screens, which hit the engine via
// fetch — stub it so tests run offline.
installMockEngine();
