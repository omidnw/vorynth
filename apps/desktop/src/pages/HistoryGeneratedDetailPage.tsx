import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { GeneratedHistoryKind } from "@vorynth/types";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { GhostCard } from "@/components/ui/GhostCard";
import { fetchGeneratedEntry } from "@/features/history/history-api.js";
import { useHistoryStore } from "@/features/history/history-store.js";

/**
 * Full-page view for a saved generated history entry (Profile LLM generations).
 *
 * Renders the cached generated text (behavior summary or improved instruction)
 * in a focused, beautiful layout.
 */
export function HistoryGeneratedDetailPage() {
	const { id = "" } = useParams();
	const navigate = useNavigate();
	const closeDrawer = useHistoryStore((s) => s.closeDrawer);

	const { data: entry, isLoading } = useQuery({
		queryKey: ["history", "generated", "single", id],
		queryFn: () => fetchGeneratedEntry(id),
		enabled: Boolean(id),
	});

	if (isLoading) {
		return (
			<section className="mx-auto w-full max-w-max-content-width px-gutter py-16">
				<div className="flex items-center justify-center gap-2 text-on-surface-variant">
					<Icon name="sync" className="animate-spin text-[18px]" />
					<span className="font-mono text-[11px] uppercase tracking-widest">
						Loading…
					</span>
				</div>
			</section>
		);
	}

	if (!entry) {
		return (
			<section className="mx-auto w-full max-w-max-content-width px-gutter py-16">
				<GhostCard className="flex flex-col items-center gap-4 text-center">
					<Icon
						name="error_outline"
						className="text-[40px] text-on-tertiary-container"
					/>
					<h2 className="font-headline text-headline-md text-primary">
						Generation not found
					</h2>
					<p className="font-body text-body-md text-on-surface-variant">
						This generated result may have been deleted or is no longer
						available.
					</p>
					<Button
						variant="secondary"
						icon="arrow_back"
						onClick={() => navigate("/profile")}
					>
						Back to Profile
					</Button>
				</GhostCard>
			</section>
		);
	}

	const isSummary = entry.kind === "behavior-summary";

	return (
		<article className="mx-auto w-full max-w-max-content-width px-gutter pb-32 pt-8">
			{/* Header */}
			<header className="mb-12">
				<Link
					to="/profile"
					onClick={() => closeDrawer()}
					className="mb-6 inline-flex items-center gap-2 font-label text-label-md uppercase text-on-surface-variant hover:text-primary"
				>
					<Icon name="arrow_back" className="text-[18px]" />
					Back to Profile
				</Link>

				<div className="mb-4 flex flex-wrap items-center gap-3">
					<KindBadge kind={entry.kind} />
					<span className="font-mono text-[11px] text-on-tertiary-container">
						{timeAgo(entry.createdAt)}
					</span>
					{entry.tokensUsed > 0 ? (
						<>
							<span className="h-1 w-1 rounded-full bg-outline-variant" />
							<span className="font-mono text-[11px] text-on-tertiary-container">
								{entry.tokensUsed.toLocaleString()} tokens
							</span>
						</>
					) : null}
					{entry.archived ? (
						<>
							<span className="h-1 w-1 rounded-full bg-outline-variant" />
							<span className="font-mono text-[11px] text-on-tertiary-container">
								archived
							</span>
						</>
					) : null}
				</div>

				<h1 className="font-headline text-display-lg leading-tight text-primary dark:text-primary-fixed">
					{entry.title}
				</h1>

				<p className="mt-4 font-label text-label-sm uppercase tracking-widest text-on-surface-variant">
					{isSummary ? "Behavior Summary" : "Improved Custom Instruction"}
				</p>
			</header>

			{/* Divider */}
			<div className="mb-10 h-px bg-outline-variant" />

			{/* Generated text */}
			<GhostCard className="border-l-2 border-l-primary">
				<h3 className="mb-4 flex items-center gap-2 font-label text-label-md uppercase tracking-widest text-primary">
					<Icon
						name={isSummary ? "insights" : "tune"}
						className="text-[16px]"
					/>
					{isSummary ? "Behavior Summary" : "Improved Instruction"}
				</h3>
				<div
					className="whitespace-pre-wrap font-body text-body-lg leading-relaxed text-on-surface"
					dir="auto"
				>
					{entry.result}
				</div>
				{entry.tokensUsed > 0 ? (
					<div className="mt-6 flex items-center gap-2 border-t border-outline-variant pt-4 font-mono text-[12px] text-on-tertiary-container">
						<Icon name="token" className="text-[14px]" />
						{entry.tokensUsed.toLocaleString()} tokens used
					</div>
				) : null}
			</GhostCard>

			{/* Floating action footer */}
			<footer className="fixed bottom-12 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-outline-variant bg-surface-container px-6 py-3 shadow-2xl">
				<ActionBtn
					icon="refresh"
					label={isSummary ? "Regenerate" : "Improve again"}
					onClick={() => {
						closeDrawer();
						navigate("/profile");
					}}
				/>
				<div className="mx-2 h-6 w-px bg-outline-variant" />
				<ActionBtn
					icon="content_copy"
					label="Copy text"
					onClick={() => {
						void navigator.clipboard.writeText(entry.result);
					}}
				/>
				<div className="mx-2 h-6 w-px bg-outline-variant" />
				<ActionBtn
					icon="arrow_back"
					label="Back"
					onClick={() => {
						closeDrawer();
						navigate("/profile");
					}}
				/>
			</footer>
		</article>
	);
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: GeneratedHistoryKind }) {
	const isSummary = kind === "behavior-summary";
	return (
		<span className="inline-flex items-center gap-1.5 rounded bg-primary-container px-2.5 py-1 font-label text-[11px] uppercase tracking-widest text-on-primary-container">
			<Icon name={isSummary ? "insights" : "tune"} className="text-[14px]" />
			{isSummary ? "Behavior Summary" : "Instruction"}
		</span>
	);
}

function ActionBtn({
	icon,
	label,
	onClick,
}: {
	icon: string;
	label: string;
	onClick?: () => void;
}) {
	return (
		<button
			onClick={onClick}
			className="flex items-center gap-2 rounded-full px-4 py-2 transition-colors hover:bg-surface-container-high"
		>
			<Icon name={icon} className="text-[20px]" />
			<span className="font-label text-label-md uppercase tracking-wide">
				{label}
			</span>
		</button>
	);
}

function timeAgo(iso: string): string {
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return "—";
	const diff = Date.now() - then;
	const sec = Math.round(diff / 1000);
	if (sec < 60) return "just now";
	const min = Math.round(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const day = Math.round(hr / 24);
	if (day < 30) return `${day}d ago`;
	const mo = Math.round(day / 30);
	if (mo < 12) return `${mo}mo ago`;
	return `${Math.round(mo / 12)}y ago`;
}
