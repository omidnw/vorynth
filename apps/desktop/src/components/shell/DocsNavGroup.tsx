import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import { SidebarNavItem } from "./SidebarNav";
import {
	DOCS_SECTIONS,
	TRANSPARENCY_SECTIONS,
	type DocsSection,
} from "@/features/docs/docs-data.js";
import { usePluginDocsSections } from "@/plugins/plugin-hooks.js";

/**
 * Expandable "Docs" sidebar group — the docs sections live under the Docs
 * item as a submenu (Pages + Transparency), instead of a second in-page rail.
 *
 * Auto-expands while on /docs, collapses when you leave; the chevron toggles
 * it manually. Section clicks deep-link to `/docs#<id>`: same-page jumps set
 * the hash natively (which fires `hashchange`, so DocsPage scrolls and the
 * highlight follows — react-router's navigate() changes the URL without
 * firing hashchange), cross-page jumps navigate normally.
 */
export function DocsNavGroup() {
	const { t } = useTranslation();
	const location = useLocation();
	const navigate = useNavigate();
	const [expanded, setExpanded] = useState(false);
	const [docsHash, setDocsHash] = useState("");
	// v1.9.0 — docs sections contributed by enabled runtime UI plugins.
	const pluginSections = usePluginDocsSections();
	const allSections = [...DOCS_SECTIONS, ...pluginSections];

	const onDocs = location.pathname === "/docs";

	// Auto-expand on /docs, collapse elsewhere (manual toggles persist
	// until the route changes).
	useEffect(() => {
		setExpanded(onDocs);
	}, [onDocs]);

	// Track the docs hash for the active-section highlight. React-router
	// navigations update `location.key` but may not fire the native
	// `hashchange` event; native hash jumps (`location.hash = ...`) fire
	// `hashchange` but don't touch react-router state — so read the real
	// hash on both signals.
	useEffect(() => {
		const readHash = () => setDocsHash(window.location.hash.replace(/^#/, ""));
		readHash();
		window.addEventListener("hashchange", readHash);
		return () => window.removeEventListener("hashchange", readHash);
	}, [location.key]);

	const goSection = (id: string) => {
		if (onDocs) {
			window.location.hash = id;
		} else {
			navigate(`/docs#${id}`);
		}
	};

	return (
		<div>
			<div className="relative">
				<SidebarNavItem to="/docs" icon="menu_book" label={t("nav.docs")} />
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					aria-label={expanded ? t("nav.docsCollapse") : t("nav.docsExpand")}
					aria-expanded={expanded}
					className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
				>
					<Icon
						name="expand_more"
						className={cn(
							"text-[18px] transition-transform duration-200",
							expanded && "rotate-180",
						)}
					/>
				</button>
			</div>

			{expanded ? (
				<div className="ms-3 mt-1 space-y-1 border-s border-outline-variant ps-2 animate-fade-in">
					<p className="px-2 pt-1 font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
						{t("nav.docsPages")}
					</p>
					{allSections.map((s) => (
						<DocsSectionItem
							key={s.id}
							section={s}
							active={isDocsHashActive(docsHash, s.id)}
							onClick={() => goSection(s.id)}
						/>
					))}
					<p className="px-2 pt-2 font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
						{t("nav.docsTransparency")}
					</p>
					{TRANSPARENCY_SECTIONS.map((s) => (
						<DocsSectionItem
							key={s.id}
							section={s}
							active={isDocsHashActive(docsHash, s.id)}
							onClick={() => goSection(s.id)}
						/>
					))}
				</div>
			) : null}
		</div>
	);
}

/** One docs section row inside the submenu. */
function DocsSectionItem({
	section,
	active,
	onClick,
}: {
	section: DocsSection;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-current={active ? "true" : undefined}
			className={cn(
				"flex w-full items-center gap-2 rounded px-2 py-1.5 text-start font-body text-body-sm transition-colors",
				active
					? "bg-primary-container text-on-primary-container"
					: "text-on-surface-variant hover:bg-surface-container-high",
			)}
		>
			<Icon name={section.icon} className="shrink-0 text-[15px]" />
			<span className="truncate">{section.title}</span>
		</button>
	);
}

/**
 * True when the current hash points at this section or one of its sub-anchors
 * (e.g. `sources-method-rss` still highlights the Sources section).
 */
function isDocsHashActive(hash: string, sectionId: string): boolean {
	return hash === sectionId || hash.startsWith(sectionId + "-");
}
