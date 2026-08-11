import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GhostCard } from "@/components/ui/GhostCard";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { DomainTag } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
	DOCS_SECTIONS,
	TRANSPARENCY_SECTIONS,
	type DocsBlock,
	type DocsSection,
} from "@/features/docs/docs-data.js";
import { usePluginDocsSections } from "@/plugins/plugin-hooks.js";

/**
 * Documentation & Tutorial page (v1.6.0).
 *
 * The section TOC lives in the sidebar as a submenu under "Docs" (see
 * DocsNavGroup) — this page renders the content only, built from rich blocks
 * (paragraphs, icon-labeled feature rows, bullet lists, visual flow diagrams)
 * so the docs read with the app's design language, not walls of text.
 * Honors `#<id>` deep links from every page. v1.8.1 — a search box filters
 * the sections by title, summary, and every block's text.
 */
export function DocsPage() {
	const { t } = useTranslation();
	const [activeId, setActiveId] = useState("");
	// v1.9.0 — docs sections contributed by enabled runtime UI plugins.
	const pluginSections = usePluginDocsSections();
	// v1.8.1 — docs search (title + summary + block text).
	const [q, setQ] = useState("");

	// Scroll to the `#<id>` section on load and on hash change.
	useEffect(() => {
		const scrollToHash = () => {
			const id = window.location.hash.replace(/^#/, "");
			if (id) {
				setActiveId(id);
				// Slight delay so the section is mounted before scrolling.
				setTimeout(() => {
					document
						.getElementById(id)
						?.scrollIntoView({ behavior: "smooth", block: "start" });
				}, 50);
			}
		};
		scrollToHash();
		window.addEventListener("hashchange", scrollToHash);
		return () => window.removeEventListener("hashchange", scrollToHash);
	}, []);

	const allSections = [...DOCS_SECTIONS, ...pluginSections];

	const matches = useMemo(() => {
		const term = q.trim().toLowerCase();
		if (!term) return null;
		const hit = (s: DocsSection) => sectionSearchText(s).includes(term);
		return {
			guides: allSections.filter(hit),
			transparency: TRANSPARENCY_SECTIONS.filter(hit),
			any: allSections.some(hit) || TRANSPARENCY_SECTIONS.some(hit),
		};
	}, [q, allSections]);
	const guides = matches ? matches.guides : allSections;
	const transparency = matches ? matches.transparency : TRANSPARENCY_SECTIONS;

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			<header className="mb-10">
				<h2 className="mb-2 font-headline text-headline-lg text-primary dark:text-primary-fixed">
					Documentation
				</h2>
				<p className="max-w-prose font-body text-body-md text-on-surface-variant">
					How Vorynth works, explained in plain terms — every screen, plus the
					transparency section behind every ranking and AI answer.
				</p>
				{/* v1.8.1 — search the docs' titles and text. */}
				<Input
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder={t("docs.searchPlaceholder")}
					icon="search"
					aria-label={t("docs.searchPlaceholder")}
					className="mt-4 max-w-md"
				/>
			</header>

			{/* Content — the section TOC is the Docs submenu in the sidebar. */}
			<div className="min-w-0 space-y-8">
				{matches && !matches.any ? (
					<GhostCard className="p-8 text-center">
						<Icon
							name="search_off"
							className="text-[28px] text-on-tertiary-container"
						/>
						<p className="mt-2 font-body text-body-md text-on-surface-variant">
							{t("docs.noResults", { q: q.trim() })}
						</p>
					</GhostCard>
				) : (
					<>
						{/* Per-page guides */}
						<div className="space-y-4">
							{guides.map((s) => (
								<SectionCard
									key={s.id}
									section={s}
									active={activeId === s.id}
								/>
							))}
						</div>

						{/* Transparency */}
						{transparency.length > 0 ? (
							<div className="space-y-4">
								<div className="flex items-center gap-2">
									<Icon
										name="visibility"
										className="text-[24px] text-secondary"
									/>
									<h3 className="font-label text-label-md uppercase tracking-widest text-secondary">
										Transparency — how decisions are made
									</h3>
								</div>
								<p className="font-body text-body-md text-on-surface-variant">
									Vorynth never hides its reasoning. These sections explain the
									exact mechanics behind collection, ranking, Ask AI, and the
									brief summary — stored signals and real formulas, never
									invented explanations.
								</p>
								{transparency.map((s) => (
									<SectionCard
										key={s.id}
										section={s}
										active={activeId === s.id}
										isTransparency
									/>
								))}
							</div>
						) : null}
					</>
				)}
			</div>
		</section>
	);
}

/** All the searchable text of a docs section — title, summary, every block. */
function sectionSearchText(s: DocsSection): string {
	const parts = [s.title, s.summary];
	for (const b of s.blocks) {
		if (b.type === "paragraph") parts.push(b.text);
		else if (b.type === "bullets") parts.push(...b.items);
		else if (b.type === "features") {
			for (const f of b.items) parts.push(f.label, f.text ?? "");
		} else if (b.type === "flow") {
			parts.push(b.title ?? "");
			for (const st of b.steps) parts.push(st.label, st.description ?? "");
		}
	}
	return parts.join(" ").toLowerCase();
}

function SectionCard({
	section,
	active,
	isTransparency = false,
}: {
	section: DocsSection;
	active: boolean;
	isTransparency?: boolean;
}) {
	return (
		<GhostCard
			id={section.id}
			className={cn(
				"scroll-mt-24",
				active ? "ring-2 ring-primary/40" : undefined,
			)}
		>
			{/* Heading with the section's icon */}
			<div className="mb-3 flex items-center gap-3">
				<span
					className={cn(
						"flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
						isTransparency
							? "bg-secondary-container text-on-secondary-container"
							: "bg-primary-container text-on-primary-container",
					)}
				>
					<Icon name={section.icon} className="text-[18px]" />
				</span>
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						{isTransparency ? (
							<DomainTag className="shrink-0">Transparency</DomainTag>
						) : null}
						<h4 className="font-headline text-headline-md text-on-surface">
							{section.title}
						</h4>
					</div>
					<p className="font-body text-body-sm italic text-secondary">
						{section.summary}
					</p>
				</div>
			</div>

			{/* Rich content blocks */}
			<div className="space-y-4">
				{section.blocks.map((block, i) => (
					<BlockRenderer key={i} block={block} />
				))}
			</div>

			{section.pageRoute ? (
				<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant pt-4">
					<Link
						to={section.pageRoute}
						className="inline-flex items-center gap-1.5 font-label text-label-sm uppercase tracking-wide text-secondary transition-colors hover:text-primary hover:underline"
					>
						<Icon name="open_in_new" className="text-[14px]" />
						Go to {section.title}
					</Link>
				</div>
			) : null}
		</GhostCard>
	);
}

function BlockRenderer({ block }: { block: DocsBlock }) {
	// Render the block's content, then wrap it in an anchor target when the
	// block declares an `id` — that id becomes a deep link (`/docs#<id>`).
	let content: ReactNode;
	switch (block.type) {
		case "paragraph":
			content = (
				<p
					className="font-body text-body-md leading-relaxed text-on-surface-variant"
					dir="auto"
				>
					{block.text}
				</p>
			);
			break;

		case "bullets":
			content = (
				<ul className="space-y-1.5">
					{block.items.map((item, i) => (
						<li key={i} className="flex items-start gap-2">
							<Icon
								name="chevron_right"
								className="mt-0.5 shrink-0 text-[16px] text-secondary"
							/>
							<span
								className="font-body text-body-md leading-relaxed text-on-surface-variant"
								dir="auto"
							>
								{item}
							</span>
						</li>
					))}
				</ul>
			);
			break;

		case "features":
			content = (
				<div className="space-y-2">
					{block.items.map((f, i) => (
						<div
							key={i}
							className="flex items-start gap-3 rounded border border-outline-variant bg-surface-container-low px-4 py-3"
						>
							<span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
								<Icon name={f.icon} className="text-[16px]" />
							</span>
							<div className="min-w-0">
								<span className="font-label text-label-md text-on-surface">
									{f.label}
								</span>
								{f.text ? (
									<p
										className="font-body text-body-sm leading-relaxed text-on-surface-variant"
										dir="auto"
									>
										{f.text}
									</p>
								) : null}
							</div>
						</div>
					))}
				</div>
			);
			break;

		case "flow":
			content = (
				<div>
					{block.title ? (
						<p className="mb-2 font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
							{block.title}
						</p>
					) : null}
					<div className="flex flex-wrap items-center gap-2">
						{block.steps.map((step, i) => (
							<Fragment key={i}>
								{i > 0 ? (
									<Icon
										name="arrow_forward"
										className="shrink-0 text-[16px] text-on-tertiary-container"
									/>
								) : null}
								<span
									className="inline-flex items-center gap-2 rounded border border-outline-variant bg-surface-container-low px-3 py-1.5"
									title={step.description}
								>
									<Icon
										name={step.icon}
										className="shrink-0 text-[16px] text-secondary"
									/>
									<span className="font-label text-label-sm text-on-surface">
										{step.label}
									</span>
								</span>
							</Fragment>
						))}
					</div>
				</div>
			);
			break;

		default:
			content = null;
	}

	return block.id ? (
		<div id={block.id} className="scroll-mt-24">
			{content}
		</div>
	) : (
		content
	);
}
