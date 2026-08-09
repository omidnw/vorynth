import type {
	PluginSecurityFlag,
	PluginSecurityReport,
	PluginSecuritySeverity,
} from "@vorynth/types";

/**
 * Plugin bundle security scanner (v1.8.0).
 *
 * Runs a static pattern scan over an installed plugin's `bundle.js` at scan/
 * install time and returns a `PluginSecurityReport`. The model is deliberately
 * conservative: it REPORTS patterns (regex over the raw bundle text — minified
 * bundles match fine), never executes anything, and the user decides what to
 * do with the warnings. Built-in plugins are trusted Vorynth code and are
 * never scanned.
 *
 * Severity mapping (webview context — no Node, no filesystem):
 *   HIGH   — code injection: eval, Function constructor, string timers,
 *            dynamic <script> injection, dynamic import of remote URLs.
 *   MEDIUM — DOM-injection sinks, external URLs / network calls to non-local
 *            hosts, hardcoded non-loopback IP addresses.
 *   LOW    — Node.js built-ins (inert in a webview) and crypto-mining strings.
 *
 * Loopback hosts (127.0.0.1 / localhost / ::1) and the engine port are benign:
 * plugins legitimately talk to the local engine and load their assets from it.
 * A static scan cannot prove what a computed `fetch(variable)` targets, so a
 * network call whose URL argument isn't a literal is flagged too.
 *
 * The same checklist lives as Semgrep rules in `.semgrep/plugin-bundles.yml`
 * (CI scans the first-party plugin source in apps/desktop/plugins/); keep the
 * two lists in sync when adding a pattern.
 */

interface SecurityRule {
	/** Stable rule id — becomes PluginSecurityFlag.id. */
	id: string;
	severity: Exclude<PluginSecuritySeverity, "clean">;
	/** Human-readable label — surfaced on the Plugins page. */
	label: string;
	/**
	 * Collect matches. Returns null when nothing matched; otherwise the number
	 * of distinct matches and the first one (for evidence).
	 */
	match: (code: string) => { count: number; evidence: string } | null;
}

/** Regex rule with an optional per-match accept filter. */
interface RegexRule {
	id: string;
	severity: Exclude<PluginSecuritySeverity, "clean">;
	label: string;
	pattern: RegExp;
	/** Only matches whose text passes this predicate are counted. */
	accept?: (match: string) => boolean;
}

/** Build a RegexRule into a SecurityRule. */
function regexRule(rule: RegexRule): SecurityRule {
	return {
		id: rule.id,
		severity: rule.severity,
		label: rule.label,
		match: (code) => {
			// prettier-ignore
			const re = new RegExp( // nosemgrep: detect-non-literal-regexp
				rule.pattern.source,
				rule.pattern.flags.includes("g")
					? rule.pattern.flags
					: `${rule.pattern.flags}g`,
			);
			const accept = rule.accept ?? (() => true);
			let count = 0;
			let evidence = "";
			for (const m of code.matchAll(re)) {
				const match = m[0] ?? "";
				if (!accept(match)) continue;
				count += 1;
				if (evidence === "") evidence = match;
			}
			if (count === 0) return null;
			return { count, evidence: truncate(evidence) };
		},
	};
}

const RULES: SecurityRule[] = [
	regexRule({
		id: "eval",
		severity: "high",
		label: "eval() — executes strings as code",
		pattern: /\beval\s*\(/g,
	}),
	regexRule({
		id: "function-constructor",
		severity: "high",
		label: "Function constructor — compiles code at runtime",
		pattern: /(?:new\s+)?Function\s*\(/g,
	}),
	regexRule({
		id: "string-timer",
		severity: "high",
		label: "setTimeout / setInterval with a string payload",
		pattern: /\b(?:setTimeout|setInterval)\s*\(\s*["']/g,
	}),
	regexRule({
		id: "script-injection",
		severity: "high",
		label: "dynamically injected <script> element",
		pattern: /createElement\s*\(\s*["']script["']|\.src\s*=\s*["']https?:\/\//g,
	}),
	regexRule({
		id: "remote-import",
		severity: "high",
		label: "dynamic import() of a remote URL",
		pattern: /\bimport\s*\(\s*["']https?:\/\//g,
	}),
	regexRule({
		id: "dom-xss",
		severity: "medium",
		label:
			"DOM-injection sinks (innerHTML / document.write / insertAdjacentHTML)",
		pattern:
			/\.innerHTML\s*=|\.outerHTML\s*=|document\.write\s*\(|\.insertAdjacentHTML\s*\(/g,
	}),
	regexRule({
		id: "external-url",
		severity: "medium",
		label: "external URL — links or endpoints outside this app",
		pattern: /\bhttps?:\/\/[^\s"'`)\]]+/g,
		accept: (m) => !isBenignHost(hostOf(m)),
	}),
	{
		id: "network-apis",
		severity: "medium",
		label: "network APIs — can send data to any host at runtime",
		match: (code) => {
			const calls = [
				...code.matchAll(
					/\bfetch\s*\(|\bnew\s+XMLHttpRequest\b|\bnew\s+WebSocket\b|\bnew\s+EventSource\b|navigator\.sendBeacon\s*\(/g,
				),
			];
			const hits: string[] = [];
			for (const call of calls) {
				const ahead = code.slice(call.index, call.index + 160);
				const literal = ahead.match(/["']([^"']{2,140})["']/);
				if (!literal) {
					// Computed/unknown target — can't prove it's local.
					hits.push((call[0] ?? "network call").trim());
					continue;
				}
				const url = literal[1] ?? "";
				if (/^https?:\/\//.test(url)) {
					if (isBenignHost(hostOf(url))) continue;
					hits.push(url);
				} else if (/^[a-z][a-z0-9+.-]*:\/\//.test(url)) {
					// ws:, wss:, file:, … anything but the local app protocol.
					hits.push(url);
				}
				// Relative paths (fetch("/plugins/…")) are engine assets.
			}
			if (hits.length === 0) return null;
			return {
				count: hits.length,
				evidence: truncate(hits[0] ?? "network call"),
			};
		},
	},
	regexRule({
		id: "hardcoded-ip",
		severity: "medium",
		label: "hardcoded IP address",
		pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b|\[[0-9a-fA-F:]+\]/g,
		accept: (m) => !isLoopbackHost(m),
	}),
	regexRule({
		id: "node-builtins",
		severity: "low",
		label: "Node.js built-ins — inert in the webview, but suspicious",
		pattern:
			/\brequire\s*\(|\bprocess\.(?:env|versions|argv)\b|\bchild_process\b|\bnode:fs\b/g,
	}),
	regexRule({
		id: "crypto-mining",
		severity: "low",
		label: "crypto-mining fingerprint (hash loops / mining scripts)",
		pattern: /\bcryptonight\b|\bcoinhive\b|\bSHA-256\b/g,
	}),
];

/** Scan an installed plugin's bundle text. */
export function scanPluginBundle(
	code: string,
	scannedAt = new Date().toISOString(),
): PluginSecurityReport {
	const flags: PluginSecurityFlag[] = [];
	let worst: PluginSecuritySeverity = "clean";
	for (const rule of RULES) {
		let result: ReturnType<SecurityRule["match"]>;
		try {
			result = rule.match(code);
		} catch {
			// A pathological bundle must never take the scan (or engine) down.
			result = null;
		}
		if (!result) continue;
		flags.push({
			id: rule.id,
			severity: rule.severity,
			label: rule.label,
			evidence: result.evidence,
			count: result.count,
		});
		if (isWorse(rule.severity, worst)) worst = rule.severity;
	}
	return { severity: worst, flags, scannedAt };
}

/** True when `a` is a stricter severity than `b`. */
function isWorse(
	a: Exclude<PluginSecuritySeverity, "clean">,
	b: PluginSecuritySeverity,
): boolean {
	const rank: Record<PluginSecuritySeverity, number> = {
		clean: 0,
		low: 1,
		medium: 2,
		high: 3,
	};
	return rank[a] > rank[b];
}

/** Host of a URL ("http://[::1]:34117/x" → "[::1]"). Empty when unparseable. */
function hostOf(url: string): string {
	const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i.exec(url);
	return m?.[1] ?? "";
}

/** Loopback + the engine's own host are benign destinations. */
function isBenignHost(host: string): boolean {
	return isLoopbackHost(host) || host.toLowerCase().startsWith("tauri:");
}

/** True for 127.0.0.1 / localhost / ::1 (with optional port/brackets). */
function isLoopbackHost(hostOrIp: string): boolean {
	const h = hostOrIp
		.toLowerCase()
		.replace(/^\[|\]$/g, "")
		.replace(/:\d+$/, "");
	return (
		h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0"
	);
}

/** Cap evidence snippets so a bundle can't bloat the report. */
function truncate(s: string, max = 120): string {
	return s.length > max ? `${s.slice(0, max)}…` : s;
}
