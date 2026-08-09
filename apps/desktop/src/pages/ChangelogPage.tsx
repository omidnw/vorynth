import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ImportanceBadge, DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import {
	RELEASES,
	type ChangeType,
	type Release,
} from "@/features/changelog/changelog-data.js";
import { fetchEngineStatus } from "@/features/brief/brief-api.js";

/**
 * Changelog page — release notes with brand-themed codenames.
 *
 * Static data (ships with the bundle). The current running version is read
 * from the engine status so the user can see which release they're on.
 */
export function ChangelogPage() {
	const { t } = useTranslation();
	const { data: status } = useQuery({
		queryKey: ["engine-status"],
		queryFn: fetchEngineStatus,
		refetchInterval: 30_000,
	});
	const currentVersion = status?.version ?? "1.0.0";

	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			<header className="mb-12">
				<span className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
					{t("changelogPage.releaseNotes")}
				</span>
				<h2 className="font-headline text-headline-lg text-primary dark:text-primary-fixed">
					{t("changelogPage.title")}
				</h2>
				<p className="mt-2 font-body text-body-md text-on-surface-variant">
					{t("changelogPage.subtitle")}
				</p>
			</header>

			<div className="space-y-16">
				{RELEASES.map((release) => (
					<ReleaseCard
						key={release.version}
						release={release}
						isCurrent={release.version === currentVersion}
					/>
				))}
			</div>
		</section>
	);
}

function ReleaseCard({
	release,
	isCurrent,
}: {
	release: Release;
	isCurrent: boolean;
}) {
	const { t } = useTranslation();
	const [showTechnical, setShowTechnical] = useState(false);
	return (
		<GhostCard>
			{/* Version header */}
			<div className="mb-6 flex flex-wrap items-center gap-3">
				<h3 className="font-headline text-headline-md text-primary dark:text-primary-fixed">
					v{release.version}
				</h3>
				<span className="font-body text-body-lg italic text-secondary">
					{release.codename}
				</span>
				{isCurrent ? (
					<ImportanceBadge tier="signal">
						{t("changelogPage.current")}
					</ImportanceBadge>
				) : null}
				<span className="ms-auto font-mono text-mono-technical text-on-tertiary-container">
					{new Date(release.date).toLocaleDateString("en-US", {
						day: "numeric",
						month: "long",
						year: "numeric",
					})}
				</span>
			</div>

			<p className="mb-6 font-body text-body-lg leading-relaxed text-on-surface-variant">
				{release.summary}
			</p>

			{/* Changes list — user-facing */}
			<div className="space-y-3">
				{release.changes.map((change, i) => (
					<div key={i} className="flex items-start gap-3">
						<ChangeBadge type={change.type} />
						<p className="flex-1 font-body text-body-md leading-relaxed text-on-surface">
							{change.text}
						</p>
					</div>
				))}
			</div>

			{/* Technical details — behind a toggle (v1.6.0) */}
			{release.technical && release.technical.length > 0 ? (
				<div className="mt-6 border-t border-outline-variant pt-4">
					<button
						type="button"
						onClick={() => setShowTechnical((v) => !v)}
						aria-expanded={showTechnical}
						aria-controls={`technical-${release.version}`}
						className="flex items-center gap-2 rounded font-label text-label-md text-primary transition-colors hover:text-secondary"
					>
						<span className="material-symbols-outlined text-[16px]">
							{showTechnical ? "expand_less" : "expand_more"}
						</span>
						{showTechnical
							? t("changelogPage.hideTechnical")
							: t("changelogPage.showTechnical")}
					</button>
					{showTechnical ? (
						<div id={`technical-${release.version}`} className="mt-3 space-y-2">
							{release.technical.map((change, i) => (
								<div key={i} className="flex items-start gap-3">
									<span className="mt-0.5 shrink-0 rounded border border-outline-variant px-2 py-0.5 font-mono text-mono-technical uppercase tracking-widest text-on-tertiary-container">
										{change.type}
									</span>
									<p className="flex-1 font-mono text-mono-technical leading-relaxed text-on-surface-variant">
										{change.text}
									</p>
								</div>
							))}
						</div>
					) : null}
				</div>
			) : null}
		</GhostCard>
	);
}

function ChangeBadge({ type }: { type: ChangeType }) {
	const { t } = useTranslation();
	switch (type) {
		case "new":
			return (
				<ImportanceBadge tier="signal">
					{t("changelogPage.new")}
				</ImportanceBadge>
			);
		case "improved":
			return (
				<ImportanceBadge tier="trend">
					{t("changelogPage.improved")}
				</ImportanceBadge>
			);
		case "fixed":
			return <DomainTag>{t("changelogPage.fixed")}</DomainTag>;
		case "security":
			return (
				<DomainTag className="border-error text-error">
					{t("changelogPage.security")}
				</DomainTag>
			);
		default:
			return null;
	}
}
