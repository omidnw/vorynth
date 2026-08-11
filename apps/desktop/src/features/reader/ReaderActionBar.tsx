import { MenuButton } from "@/components/ui/Select";
import { Icon } from "@/components/ui/Icon";
import { splitReaderActions, type ReaderAction } from "./reader-actions.js";

/**
 * The story-reader floating action bar (v1.8.0).
 *
 * Renders the user's bar actions up front (in the Profile-chosen order) and
 * the rest behind a "More ⋮" menu — nothing is hidden, the bar just stays
 * uncluttered. Which actions sit where is a Profile preference resolved by
 * `readerActionLayout` (`ui.readerActions` order + `ui.readerActionsInMore`);
 * see `reader-actions.ts`.
 */
export function ReaderActionBar({
	actions,
	layout,
	moreLabel,
	moreAriaLabel,
}: {
	actions: ReaderAction[];
	/** v1.8.1 — `readerActionLayout(settings)`: full order + the in-More set. */
	layout: { order: string[]; inMore: Set<string> };
	moreLabel: string;
	moreAriaLabel: string;
}) {
	const { pinned, more } = splitReaderActions(actions, layout);

	return (
		<footer className="fixed bottom-12 start-1/2 z-50 flex -translate-x-1/2 rtl:translate-x-1/2 items-center gap-1 rounded-full border border-outline-variant bg-surface-container px-4 py-2.5 shadow-2xl">
			{pinned.map((a) => (
				<ActionBtn
					key={a.id}
					icon={a.icon}
					label={a.label}
					busy={a.busy}
					onClick={a.onClick}
				/>
			))}
			{more.length > 0 ? (
				<>
					<div className="mx-1 h-6 w-px bg-outline-variant" />
					<MenuButton
						aria-label={moreAriaLabel}
						dropUp
						items={more.map((a) => ({
							key: a.id,
							label: a.label,
							icon: a.icon,
							onClick: a.onClick,
						}))}
					>
						<span className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 font-label text-label-md uppercase tracking-wide">
							<Icon name="more_vert" className="text-[20px]" />
							{moreLabel}
						</span>
					</MenuButton>
				</>
			) : null}
		</footer>
	);
}

function ActionBtn({
	icon,
	label,
	busy,
	onClick,
}: {
	icon: string;
	label: string;
	busy?: boolean;
	onClick?: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-busy={busy}
			className={`flex items-center gap-2 rounded-full px-3 py-2 transition-colors hover:bg-surface-container-high ${
				busy ? "opacity-70" : ""
			}`}
		>
			<Icon name={icon} className="text-[20px]" />
			<span className="font-label text-label-md uppercase tracking-wide">
				{label}
			</span>
		</button>
	);
}
