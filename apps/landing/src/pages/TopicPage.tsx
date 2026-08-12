import { Icon } from "../components/Icon";
import { DocsHeader } from "./DocsHeader";
import { TOPIC_PAGES, type TopicPageData } from "../content";

/**
 * Keyword landing page — one of /ai-news-reader/, /local-first/, /rss-reader/,
 * /open-source/. Content comes from TOPIC_PAGES in content.ts and is strictly
 * factual (real product capabilities, no opinions). The slug is read from the
 * URL path, or passed as a prop in tests.
 */
function slugFromPath(): string {
	const match = window.location.pathname.match(/\/([^/]+)\/?$/);
	const slug = match?.[1] ?? "";
	return slug in TOPIC_PAGES ? slug : "";
}

const CTA = {
	href: "#platforms",
	label: "Download Vorynth",
};

export function TopicPage({ slug }: { slug?: string }) {
	const base = import.meta.env.BASE_URL;
	const page: TopicPageData | undefined = TOPIC_PAGES[slug ?? slugFromPath()];

	if (!page) {
		return (
			<div className="docs-page">
				<DocsHeader />
				<main className="container docs-body">
					<header className="docs-title">
						<div className="section-label">
							<Icon name="hub" size={16} />
							Explore Vorynth
						</div>
						<h1>Explore Vorynth</h1>
						<p className="section-sub">
							The pages that explain what Vorynth does, in plain terms.
						</p>
					</header>
					<ul className="src-list">
						{Object.values(TOPIC_PAGES).map((p) => (
							<li className="src-item" key={p.slug}>
								<a href={`${base}${p.slug}/`}>{p.title}</a>
								<span className="src-meta">{p.label}</span>
							</li>
						))}
					</ul>
				</main>
			</div>
		);
	}

	return (
		<div className="docs-page">
			<DocsHeader />
			<main className="container docs-body">
				<header className="docs-title">
					<div className="section-label">
						<Icon name="hub" size={16} />
						{page.label}
					</div>
					<h1>{page.title}</h1>
					<p className="section-sub">{page.sub}</p>
				</header>

				<p className="topic-intro">{page.intro}</p>

				{page.sections.map((section) => (
					<section className="topic-section" key={section.heading}>
						<h2>{section.heading}</h2>
						<p>{section.body}</p>
						{section.bullets ? (
							<ul className="topic-bullets">
								{section.bullets.map((b) => (
									<li key={b}>
										<Icon name="check" size={16} />
										{b}
									</li>
								))}
							</ul>
						) : null}
					</section>
				))}

				<div className="topic-cta">
					<a href={`${base}${CTA.href}`} className="btn btn-primary">
						<Icon name="download" size={20} />
						{CTA.label}
					</a>
					<a
						href="https://github.com/omidnw/vorynth"
						className="btn btn-outline"
					>
						View on GitHub
						<Icon name="arrow_right_alt" size={20} />
					</a>
				</div>

				<nav className="topic-related" aria-label="Related pages">
					{page.related.map((link) => (
						<a
							className="topic-related-card"
							key={link.label}
							href={`${base}${link.href}`}
						>
							<span className="topic-related-label">{link.label}</span>
							{link.note ? (
								<span className="topic-related-note">{link.note}</span>
							) : null}
							<Icon name="arrow_forward" size={16} />
						</a>
					))}
				</nav>
			</main>
		</div>
	);
}
