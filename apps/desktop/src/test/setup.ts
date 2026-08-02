/**
 * Vitest setup — runs before every test file.
 *
 * Registers @testing-library/jest-dom matchers (toBeInTheDocument, …) against
 * Vitest's `expect` via the `/vitest` entry, and unmounts rendered trees after
 * each test. Match against user-facing semantics (roles, accessible names) —
 * the app deliberately avoids `data-test-id`; Playwright and these tests share
 * that contract (aria/role only).
 */
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

afterEach(() => cleanup());
