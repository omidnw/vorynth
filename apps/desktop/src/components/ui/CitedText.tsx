import { useState, type ReactNode } from "react";
import type { Citation } from "@vorynth/types";
import { Icon } from "./Icon";

/**
 * Render LLM text that contains `[N]` citation markers as rich prose with
 * hoverable citation chips.
 *
 * Each `[N]` becomes a superscript chip that, on hover, shows a tooltip with
 * the source story's title + source name; clicking opens the original article
 * URL in a new tab.
 *
 * If a `[N]` doesn't resolve to a known citation, it's rendered as plain text
 * so the prose stays readable.
 */
export function CitedText({
	text,
	citations,
	className,
}: {
	text: string;
	citations: Citation[];
	className?: string;
}) {
	const byN = new Map(citations.map((c) => [c.n, c]));
	const parts = parseCitedText(text, byN);

	return (
		<span className={className} dir="auto">
			{parts.map((part, i) => {
				if (part.kind === "text") {
					return <span key={i}>{part.value}</span>;
				}
				return (
					<CitationChip key={i} n={part.n} citation={part.citation ?? null} />
				);
			})}
		</span>
	);
}

type Part =
	| { kind: "text"; value: string }
	| { kind: "cite"; n: number; citation: Citation | null };

/** Matches `[1]`, `[12]`, `[1,3]`, `[1, 3, 5]`, etc. anywhere in text. */
const CITE_RE = /\[(\d[\d\s,]*)\]/g;

/**
 * Parse text into a flat list of prose/cite parts. A single bracket group like
 * `[1,3,5]` expands into three consecutive cite parts (one chip per number),
 * so each cited source gets its own hoverable chip.
 */
function parseCitedText(text: string, byN: Map<number, Citation>): Part[] {
	const parts: Part[] = [];
	let last = 0;
	for (const m of text.matchAll(CITE_RE)) {
		const inner = m[1];
		if (!inner) continue;
		const start = m.index ?? 0;
		if (start > last) {
			parts.push({ kind: "text", value: text.slice(last, start) });
		}
		const nums = inner
			.split(",")
			.map((s) => Number(s.trim()))
			.filter((n) => Number.isInteger(n) && n >= 1);
		for (const n of nums) {
			parts.push({ kind: "cite", n, citation: byN.get(n) ?? null });
		}
		last = start + m[0].length;
	}
	if (last < text.length) {
		parts.push({ kind: "text", value: text.slice(last) });
	}
	return parts;
}

function CitationChip({
	n,
	citation,
}: {
	n: number;
	citation: Citation | null;
}) {
	const [hovered, setHovered] = useState(false);

	// Unresolved citation (model invented a number) — render as muted text.
	if (!citation) {
		return (
			<sup className="px-0.5 font-mono text-[10px] text-on-tertiary-container">
				[{n}]
			</sup>
		);
	}

	return (
		<span
			className="relative inline-flex"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			<a
				href={citation.url}
				target="_blank"
				rel="noreferrer"
				className="mx-0.5 inline-flex items-center rounded bg-secondary-container px-1 font-mono text-[10px] font-semibold text-on-secondary-container no-underline transition-colors hover:bg-secondary hover:text-on-secondary"
				title={`Open: ${citation.title}`}
			>
				{n}
				<Icon name="open_in_new" className="ml-0.5 text-[10px]" />
			</a>

			{hovered ? (
				<span
					role="tooltip"
					className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded border border-outline-variant bg-surface-container-lowest p-3 text-left shadow-lg"
				>
					<span className="block font-label text-label-sm uppercase tracking-wide text-secondary">
						{citation.sourceName}
					</span>
					<span className="mt-1 block font-body text-body-md text-on-surface">
						{citation.title}
					</span>
					{citation.publishedAt ? (
						<span className="mt-1 block font-mono text-[10px] text-on-tertiary-container">
							{citation.publishedAt}
						</span>
					) : null}
					<span className="mt-2 block font-mono text-[10px] uppercase tracking-widest text-primary">
						Click to open source →
					</span>
				</span>
			) : null}
		</span>
	);
}

/** Helper to render a list of citations as a footer "Sources" block. */
export function CitationList({
	citations,
}: {
	citations: Citation[];
}): ReactNode {
	if (citations.length === 0) return null;
	return (
		<div className="mt-4 space-y-2">
			<p className="font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
				Sources
			</p>
			<ol className="space-y-1">
				{citations.map((c) => (
					<li key={c.n} className="flex items-start gap-2">
						<span className="font-mono text-[11px] text-secondary">
							[{c.n}]
						</span>
						<a
							href={c.url}
							target="_blank"
							rel="noreferrer"
							className="font-body text-body-md text-on-surface hover:text-primary hover:underline"
						>
							{c.title}
							<span className="ml-2 font-mono text-[11px] text-on-tertiary-container">
								{c.sourceName}
							</span>
						</a>
					</li>
				))}
			</ol>
		</div>
	);
}
