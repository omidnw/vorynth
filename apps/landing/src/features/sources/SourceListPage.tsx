import { useEffect } from "react";
import { Icon } from "../../components/Icon";
import { DocsHeader } from "../../pages/DocsHeader";

// The SAME curated lists that ship inside the Vorynth app (sources/*.json in
// the repo root), bundled at build time via ?raw — the page can never drift
// from what the product actually ships. Factual only: names, categories, and
// feed URLs from the data, no opinions.
import developerRaw from "../../../../../sources/developer.json?raw";
import kubernetesRaw from "../../../../../sources/devops/kubernetes.json?raw";
import securityRaw from "../../../../../sources/security.json?raw";

interface SourceEntry {
	id: string;
	name: string;
	url: string;
	type: string;
	category: string;
	adapter: string;
	configuration: Record<string, unknown>;
	country?: string;
	city?: string;
	language?: string;
	fetchWindowDays?: number;
}

interface SourceListData {
	id: string;
	name: string;
	description: string;
	nsfw: boolean;
	version: string | null;
	sources: SourceEntry[];
}

const SLUG_TO_LIST: Record<string, SourceListData> = {
	developer: JSON.parse(developerRaw) as SourceListData,
	kubernetes: JSON.parse(kubernetesRaw) as SourceListData,
	security: JSON.parse(securityRaw) as SourceListData,
};

const CATEGORY_LABELS: Record<string, string> = {
	ai: "AI & Machine Learning",
	"software-engineering": "Software Engineering",
	"programming-languages": "Programming Languages",
	"web-development": "Web Development",
	backend: "Backend",
	devops: "DevOps & Cloud Native",
	cloud: "Cloud",
	security: "Security",
	"open-source": "Open Source",
};

function categoryLabel(slug: string): string {
	return (
		CATEGORY_LABELS[slug] ??
		slug.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())
	);
}

function metaLine(s: SourceEntry): string {
	const parts: string[] = [];
	if (s.language) parts.push(s.language.toUpperCase());
	if (s.country) parts.push(s.country);
	parts.push(s.type === "rss" ? "RSS feed" : s.type);
	return parts.join(" · ");
}

/** The list slug lives in the URL: /vorynth/sources/developer/ → "developer". */
function slugFromPath(): string {
	const match = window.location.pathname.match(/\/sources\/([^/]+)/);
	return match?.[1] ?? "";
}

function groupByCategory(
	sources: SourceEntry[],
): Array<{ category: string; sources: SourceEntry[] }> {
	const groups: Array<{ category: string; sources: SourceEntry[] }> = [];
	for (const s of sources) {
		const g = groups.find((x) => x.category === s.category);
		if (g) g.sources.push(s);
		else groups.push({ category: s.category, sources: [s] });
	}
	return groups;
}

export function SourceListPage() {
	const base = import.meta.env.BASE_URL;
	const list = SLUG_TO_LIST[slugFromPath()];

	// ItemList structured data for the feeds on this page, injected client-side
	// from the same bundled data the cards render (Google renders JS, so the
	// crawler sees the identical list).
	useEffect(() => {
		if (!list) return;
		const script = document.createElement("script");
		script.type = "application/ld+json";
		script.text = JSON.stringify({
			"@context": "https://schema.org",
			"@type": "ItemList",
			name: list.name,
			description: list.description,
			numberOfItems: list.sources.length,
			itemListElement: list.sources.map((s, i) => ({
				"@type": "ListItem",
				position: i + 1,
				name: s.name,
				url: s.url,
			})),
		});
		document.head.appendChild(script);
		return () => {
			script.remove();
		};
	}, [list]);

	const otherLists = Object.entries(SLUG_TO_LIST).filter(
		([slug]) => slug !== slugFromPath(),
	);

	return (
		<div className="docs-page">
			<DocsHeader />
			<main className="container docs-body">
				{!list ? (
					<>
						<header className="docs-title">
							<div className="section-label">
								<Icon name="rss_feed" size={16} />
								Curated source lists
							</div>
							<h1>Curated source lists</h1>
							<p className="section-sub">
								The news sources Vorynth ships with, grouped by topic.
							</p>
						</header>
						<ul className="src-list">
							{Object.entries(SLUG_TO_LIST).map(([slug, l]) => (
								<li className="src-item" key={slug}>
									<a href={`${base}sources/${slug}/`}>{l.name}</a>
									<span className="src-meta">{l.sources.length} feeds</span>
								</li>
							))}
						</ul>
					</>
				) : (
					<>
						<header className="docs-title">
							<div className="section-label">
								<Icon name="rss_feed" size={16} />
								Curated source list
							</div>
							<h1>{list.name}</h1>
							<p className="section-sub">{list.description}</p>
						</header>

						<p className="src-count">
							{list.sources.length} feeds ·{" "}
							{groupByCategory(list.sources).length} categories
						</p>

						{groupByCategory(list.sources).map((group) => (
							<section className="src-group" key={group.category}>
								<h2>{categoryLabel(group.category)}</h2>
								<ul className="src-list">
									{group.sources.map((s) => (
										<li className="src-item" key={s.id}>
											<a href={s.url} target="_blank" rel="noopener noreferrer">
												<Icon name="rss_feed" size={16} />
												{s.name}
											</a>
											<span className="src-meta">{metaLine(s)}</span>
										</li>
									))}
								</ul>
							</section>
						))}

						<nav className="src-other">
							<span className="src-other-label">Other curated lists:</span>
							{otherLists.map(([slug, l], i) => (
								<span key={slug}>
									{i > 0 ? <span className="sep">·</span> : null}
									<a href={`${base}sources/${slug}/`}>{l.name}</a>
								</span>
							))}
						</nav>
					</>
				)}
			</main>
			<footer className="docs-footer">
				<p>
					These are the same curated lists that ship inside Vorynth — enable
					them in one click from the Sources page.{" "}
					<a href={base}>Learn more about Vorynth</a>.
				</p>
			</footer>
		</div>
	);
}
