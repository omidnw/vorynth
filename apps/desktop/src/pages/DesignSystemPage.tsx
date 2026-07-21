import { Button } from "@/components/ui/Button";
import { ImportanceBadge, DomainTag } from "@/components/ui/Badge";
import { GhostCard } from "@/components/ui/GhostCard";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";

/**
 * Design-system showcase.
 *
 * Renders every primitive in the active theme so we can verify the Vorynth
 * aesthetic ("Precision Minimalism", Forest & Slate) matches the examples.
 * Toggle the theme via the top-bar control to see both palettes.
 */
export function DesignSystemPage() {
	return (
		<section className="mx-auto w-full max-w-max-content-width px-gutter py-12">
			<header className="mb-12">
				<span className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
					Reference
				</span>
				<h2 className="font-headline text-headline-lg text-primary dark:text-primary-fixed">
					Design System
				</h2>
				<p className="mt-2 font-body text-body-md text-on-surface-variant">
					Every primitive, both themes. Precision Minimalism — color denotes
					action or status, never decoration.
				</p>
			</header>

			<div className="space-y-16">
				{/* Typography */}
				<GhostCard>
					<h3 className="mb-6 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						Typography
					</h3>
					<div className="space-y-4">
						<p className="font-headline text-display-lg leading-none text-primary dark:text-primary-fixed">
							Display — Newsreader
						</p>
						<p className="font-headline text-headline-lg text-primary dark:text-primary-fixed">
							Headline Large — archival, authoritative
						</p>
						<p className="font-headline text-headline-md text-primary dark:text-primary-fixed">
							Headline Medium
						</p>
						<p className="font-body text-body-lg text-on-surface">
							Body Large — Geist, the primary vehicle for content. Spend minutes
							understanding what matters instead of hours searching for it.
						</p>
						<p className="font-body text-body-md text-on-surface">
							Body Medium — for the dense, technical reading view.
						</p>
						<p className="font-label text-label-md uppercase tracking-wide text-on-surface-variant">
							Label Medium — UI affordances
						</p>
						<p className="font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
							Label Small — metadata & domain tags
						</p>
						<p className="font-mono text-mono-technical text-secondary">
							MONO_TECHNICAL — TOKEN_RATE 485 t/s
						</p>
					</div>
				</GhostCard>

				{/* Buttons */}
				<GhostCard>
					<h3 className="mb-6 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						Buttons
					</h3>
					<div className="flex flex-wrap items-center gap-4">
						<Button>Primary</Button>
						<Button icon="bolt" iconFill>
							Generate Brief
						</Button>
						<Button variant="secondary">Secondary</Button>
						<Button variant="secondary" iconRight="expand_more">
							Analyze More
						</Button>
						<Button variant="ghost">Ghost</Button>
						<Button variant="ghost" icon="arrow_back">
							Back
						</Button>
					</div>
				</GhostCard>

				{/* Badges & Tags */}
				<GhostCard>
					<h3 className="mb-6 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						Importance & Domain
					</h3>
					<div className="flex flex-wrap items-center gap-3">
						<ImportanceBadge tier="signal">Signal</ImportanceBadge>
						<ImportanceBadge tier="trend">Trend</ImportanceBadge>
						<ImportanceBadge tier="low-noise">Low Noise</ImportanceBadge>
						<DomainTag>Geopolitics</DomainTag>
						<DomainTag>AI &amp; Robotics</DomainTag>
						<DomainTag>Economics</DomainTag>
					</div>
				</GhostCard>

				{/* Inputs */}
				<GhostCard>
					<h3 className="mb-6 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						Inputs
					</h3>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<Input placeholder="Search intelligence…" icon="search" />
						<Input type="password" placeholder="sk-..." icon="lock" />
					</div>
				</GhostCard>

				{/* Recommended-action panel sample */}
				<div className="grid grid-cols-1 gap-8 md:grid-cols-2">
					<GhostCard>
						<h3 className="mb-2 font-label text-label-md uppercase tracking-wide text-on-surface-variant">
							Why it matters
						</h3>
						<p className="text-on-surface">
							End of the cost-efficient "just-in-time" era; beginning of
							"just-in-case" nationalized security stacks.
						</p>
						<h3 className="mb-2 mt-6 font-label text-label-md uppercase tracking-wide text-on-surface-variant">
							Impact
						</h3>
						<p className="text-on-surface">
							Expected 15% increase in base unit costs for Tier-1 compute
							hardware within 24 months.
						</p>
					</GhostCard>
					<div className="border-l-2 border-primary bg-surface-container-low p-6 rounded">
						<h4 className="mb-2 flex items-center gap-2 font-label text-label-md uppercase tracking-wide text-on-surface-variant">
							<Icon name="lightbulb" fill className="text-[16px]" />
							Recommended Action
						</h4>
						<p className="italic text-on-surface">
							Audit hardware procurement cycles. Shift long-term capital
							allocation toward vendors with onshore fabrication verified under
							the Bridge protocol.
						</p>
					</div>
				</div>

				{/* Surface palette */}
				<GhostCard>
					<h3 className="mb-6 font-label text-label-md uppercase tracking-widest text-on-surface-variant">
						Surface Tonal Segmentation
					</h3>
					<div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-outline-variant md:grid-cols-4">
						{[
							["lowest", "bg-surface-container-lowest"],
							["low", "bg-surface-container-low"],
							["default", "bg-surface-container"],
							["high", "bg-surface-container-high"],
						].map(([label, bg]) => (
							<div key={label} className={`${bg} p-6`}>
								<span className="font-mono text-mono-technical text-on-surface-variant">
									{label}
								</span>
							</div>
						))}
					</div>
				</GhostCard>
			</div>
		</section>
	);
}
