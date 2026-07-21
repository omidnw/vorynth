import { useQuery } from "@tanstack/react-query";
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
					Release Notes
				</span>
				<h2 className="font-headline text-headline-lg text-primary dark:text-primary-fixed">
					Changelog
				</h2>
				<p className="mt-2 font-body text-body-md text-on-surface-variant">
					Less reading. More understanding. — every change that brought us here.
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
					<ImportanceBadge tier="signal">Current</ImportanceBadge>
				) : null}
				<span className="ml-auto font-mono text-mono-technical text-on-tertiary-container">
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

			{/* Changes list */}
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
		</GhostCard>
	);
}

function ChangeBadge({ type }: { type: ChangeType }) {
	switch (type) {
		case "new":
			return <ImportanceBadge tier="signal">New</ImportanceBadge>;
		case "improved":
			return <ImportanceBadge tier="trend">Improved</ImportanceBadge>;
		case "fixed":
			return <DomainTag>Fixed</DomainTag>;
		case "security":
			return (
				<DomainTag className="border-error text-error">Security</DomainTag>
			);
		default:
			return null;
	}
}
