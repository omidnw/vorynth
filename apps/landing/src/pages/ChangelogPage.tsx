import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { DocsHeader } from "./DocsHeader";
import {
	CURRENT_VERSION,
	RELEASES,
	type ChangeType,
	type Release,
} from "@/features/changelog/changelog-data.js";

/**
 * Changelog page — the SAME release-notes data that ships in the desktop app
 * (features/changelog/changelog-data.ts), rendered with the landing's design
 * tokens. Static: no engine, no network.
 *
 * No scroll-reveal here on purpose: the v1.8.0 card alone is ~8000px tall, and
 * the Reveal observer's 12% threshold never fires for such a tall element, so
 * the newest release would stay invisible at the top. Release cards render
 * plainly.
 */

const TYPE_META: Record<ChangeType, { label: string; tone: string }> = {
	new: { label: "New", tone: "chg-badge--new" },
	improved: { label: "Improved", tone: "chg-badge--improved" },
	fixed: { label: "Fixed", tone: "chg-badge--fixed" },
	security: { label: "Security", tone: "chg-badge--security" },
};

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString("en-US", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}

function ChangeList({ changes }: { changes: Release["changes"] }) {
	return (
		<ul className="chg-changes">
			{changes.map((change, i) => (
				<li key={i}>
					<span className={`chg-badge ${TYPE_META[change.type].tone}`}>
						{TYPE_META[change.type].label}
					</span>
					<p>{change.text}</p>
				</li>
			))}
		</ul>
	);
}

function ReleaseCard({
	release,
	isCurrent,
}: {
	release: Release;
	isCurrent: boolean;
}) {
	const [showTechnical, setShowTechnical] = useState(false);
	const hasTechnical = (release.technical?.length ?? 0) > 0;
	return (
		<article className="chg-release">
			<div className="chg-release-head">
				<h3>v{release.version}</h3>
				<span className="chg-codename">{release.codename}</span>
				{isCurrent ? <span className="chg-current">Current</span> : null}
				<span className="chg-date">{formatDate(release.date)}</span>
			</div>
			<p className="chg-summary">{release.summary}</p>
			<ChangeList changes={release.changes} />
			{hasTechnical ? (
				<div className="chg-tech">
					<button
						type="button"
						onClick={() => setShowTechnical((v) => !v)}
						aria-expanded={showTechnical}
						aria-controls={`chg-technical-${release.version}`}
					>
						<Icon name="expand_more" size={18} />
						{showTechnical
							? "Hide technical details"
							: "Show technical details"}
					</button>
					<div
						id={`chg-technical-${release.version}`}
						className={`chg-tech-panel${showTechnical ? " chg-tech-panel--open" : ""}`}
					>
						<div className="chg-tech-body">
							<ChangeList changes={release.technical ?? []} />
						</div>
					</div>
				</div>
			) : null}
		</article>
	);
}

export function ChangelogPage() {
	useEffect(() => {
		document.title = "Changelog · Vorynth";
	}, []);

	return (
		<div className="docs-page">
			<DocsHeader />
			<main className="container docs-body">
				<header className="docs-title">
					<div className="section-label">
						<Icon name="new_releases" size={16} />
						Release notes
					</div>
					<h1>Changelog</h1>
					<p className="section-sub">
						What changed in every release of Vorynth — the same notes that ship
						inside the app.
					</p>
				</header>
				<div className="chg-list">
					{RELEASES.map((release) => (
						<ReleaseCard
							key={release.version}
							release={release}
							isCurrent={release.version === CURRENT_VERSION}
						/>
					))}
				</div>
			</main>
			<footer className="docs-footer">
				<p>
					Running an old version?{" "}
					<a href="https://github.com/omidnw/vorynth/releases">
						Grab the latest release
					</a>
					.
				</p>
			</footer>
		</div>
	);
}
