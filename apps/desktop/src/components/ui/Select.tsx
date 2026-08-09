import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export interface SelectOption {
	value: string;
	label: string;
	/** Optional leading icon (Material Symbols name). */
	icon?: string;
}

export interface SelectProps {
	value: string;
	onChange: (value: string) => void;
	options: SelectOption[];
	/** Accessible label — required (no unlabelled selects). */
	"aria-label": string;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
	/** Show a search field in the popover that filters options by label. */
	searchable?: boolean;
	/** Placeholder (and accessible name) for the search field. */
	searchPlaceholder?: string;
	/** Shown when the search filters out every option. */
	noResultsLabel?: string;
}

/**
 * Themed dropdown — replaces native `<select>` with Vorynth's design language
 * (1px outline-variant border, surface-container-lowest popover, secondary
 * focus ring, Material Symbols check on the active option).
 *
 * Keyboard-accessible: Tab to focus, Enter/Space to open, arrow keys to move,
 * Enter to select, Escape to close. Selects by role + aria-label (no
 * data-test-id).
 *
 * When `searchable`, the popover shows a search field on top; typing filters
 * the options by label (case-insensitive). Labels carry the native name,
 * English name, and code, so e.g. "Persian", "فارسی", or "fa" all find Persian.
 */
export function Select({
	value,
	onChange,
	options,
	"aria-label": ariaLabel,
	placeholder = "Select…",
	className,
	disabled,
	searchable = false,
	searchPlaceholder = "Search…",
	noResultsLabel = "No matches",
}: SelectProps) {
	const [open, setOpen] = useState(false);
	const [focusIndex, setFocusIndex] = useState(-1);
	const [query, setQuery] = useState("");
	const rootRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLUListElement>(null);

	const filtered =
		searchable && query.trim()
			? options.filter((o) =>
					o.label.toLowerCase().includes(query.trim().toLowerCase()),
				)
			: options;
	const selected = options.find((o) => o.value === value);

	const close = useCallback(() => {
		setOpen(false);
		setQuery("");
		setFocusIndex(-1);
	}, []);

	const openList = () => {
		setOpen(true);
		setFocusIndex(
			Math.max(
				0,
				filtered.findIndex((o) => o.value === value),
			),
		);
	};

	const selectOption = (opt: SelectOption | undefined) => {
		if (!opt) return;
		onChange(opt.value);
		close();
	};

	// Close on outside click.
	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) close();
		};
		document.addEventListener("mousedown", onDown);
		return () => document.removeEventListener("mousedown", onDown);
	}, [open, close]);

	// Scroll the focused option into view inside the popover.
	useEffect(() => {
		if (!open || focusIndex < 0 || !listRef.current) return;
		const el = listRef.current.children[focusIndex] as HTMLElement | undefined;
		el?.scrollIntoView({ block: "nearest" });
	}, [focusIndex, open]);

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (disabled) return;
		switch (e.key) {
			case "Enter":
			case " ":
				e.preventDefault();
				if (open) {
					selectOption(filtered[focusIndex]);
				} else {
					openList();
				}
				break;
			case "ArrowDown":
				e.preventDefault();
				if (!open) {
					openList();
				} else {
					setFocusIndex((i) => Math.min(filtered.length - 1, i + 1));
				}
				break;
			case "ArrowUp":
				e.preventDefault();
				if (open) setFocusIndex((i) => Math.max(0, i - 1));
				break;
			case "Escape":
				if (open) {
					e.preventDefault();
					close();
				}
				break;
			case "Tab":
				close();
				break;
		}
	};

	const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				if (filtered.length > 0) setFocusIndex(0);
				break;
			case "Enter":
				e.preventDefault();
				selectOption(filtered[focusIndex >= 0 ? focusIndex : 0]);
				break;
			case "Escape":
				e.preventDefault();
				close();
				break;
			case "Tab":
				close();
				break;
		}
	};

	return (
		<div ref={rootRef} className={cn("relative", className)}>
			<button
				type="button"
				disabled={disabled}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-label={ariaLabel}
				onClick={() => (open ? close() : openList())}
				onKeyDown={onKeyDown}
				className={cn(
					"flex w-full items-center gap-2 rounded border border-outline-variant bg-surface-container-low px-3 py-3 text-start font-label text-label-sm text-on-surface outline-none transition-colors",
					"hover:border-primary focus:border-secondary focus:bg-surface-container-lowest",
					disabled && "opacity-40",
				)}
			>
				{selected?.icon ? (
					<Icon
						name={selected.icon}
						className="shrink-0 text-[16px] text-on-surface-variant"
					/>
				) : null}
				<span
					className={cn(
						"flex-1 truncate",
						!selected && "text-on-tertiary-container",
					)}
				>
					{selected ? selected.label : placeholder}
				</span>
				<Icon
					name="expand_more"
					className={cn(
						"shrink-0 text-[16px] text-on-surface-variant transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>

			{open ? (
				<div className="absolute z-50 mt-1 w-full overflow-hidden rounded border border-outline-variant bg-surface-container-lowest shadow-lg">
					{searchable ? (
						<div className="border-b border-outline-variant px-3 py-2">
							<input
								autoFocus
								type="text"
								value={query}
								onChange={(e) => {
									setQuery(e.target.value);
									setFocusIndex(-1);
								}}
								onKeyDown={onSearchKeyDown}
								placeholder={searchPlaceholder}
								aria-label={searchPlaceholder}
								className="w-full rounded border border-outline-variant bg-surface-container-low px-2.5 py-1 font-label text-label-sm text-on-surface outline-none placeholder:text-on-tertiary-container focus:border-secondary focus:bg-surface-container-lowest"
							/>
						</div>
					) : null}
					{filtered.length > 0 ? (
						<ul
							ref={listRef}
							role="listbox"
							aria-label={ariaLabel}
							className="max-h-64 overflow-auto py-1"
						>
							{filtered.map((opt, idx) => {
								const isActive = opt.value === value;
								const isFocused = idx === focusIndex;
								return (
									<li key={opt.value} role="option" aria-selected={isActive}>
										<button
											type="button"
											onClick={() => selectOption(opt)}
											onMouseEnter={() => setFocusIndex(idx)}
											className={cn(
												"flex w-full items-center gap-2 px-3 py-1.5 text-start font-label text-label-sm transition-colors",
												isFocused
													? "bg-primary-container text-on-primary-container"
													: "text-on-surface",
											)}
										>
											{opt.icon ? (
												<Icon
													name={opt.icon}
													className="shrink-0 text-[16px]"
												/>
											) : (
												<span className="w-4 shrink-0" />
											)}
											<span className="flex-1 truncate">{opt.label}</span>
											{isActive ? (
												<Icon
													name="check"
													className="shrink-0 text-[16px] text-secondary"
												/>
											) : null}
										</button>
									</li>
								);
							})}
						</ul>
					) : (
						<p className="px-3 py-2 font-label text-label-sm text-on-tertiary-container">
							{noResultsLabel}
						</p>
					)}
				</div>
			) : null}
		</div>
	);
}

/**
 * Generic themed menu — for icon-button overflow actions ("more_vert").
 * Opens a small popover of items; closes on outside click or selection.
 */
export interface MenuItem {
	key: string;
	label: string;
	icon?: string;
	onClick: () => void;
	danger?: boolean;
}

export function MenuButton({
	items,
	"aria-label": ariaLabel,
	className,
	children,
	dropUp,
}: {
	items: MenuItem[];
	"aria-label": string;
	className?: string;
	children?: ReactNode;
	/** Open the popover above the button instead of below (bottom-anchored bars). */
	dropUp?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (!ref.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		return () => document.removeEventListener("mousedown", onDown);
	}, [open]);

	return (
		<div ref={ref} className={cn("relative", className)}>
			<button
				type="button"
				aria-label={ariaLabel}
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className="rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-primary"
			>
				{children ?? <Icon name="more_vert" className="text-[18px]" />}
			</button>
			{open ? (
				<div
					role="menu"
					className={`absolute end-0 z-50 min-w-[10rem] overflow-hidden rounded border border-outline-variant bg-surface-container-lowest py-1 shadow-lg animate-scale-in ${
						dropUp ? "bottom-full mb-1" : "mt-1"
					}`}
				>
					{items.map((item) => (
						<button
							key={item.key}
							role="menuitem"
							type="button"
							onClick={() => {
								item.onClick();
								setOpen(false);
							}}
							className={cn(
								"flex w-full items-center gap-2 px-3 py-1.5 text-start font-label text-label-sm transition-colors hover:bg-primary-container hover:text-on-primary-container",
								item.danger && "text-error hover:bg-error/10 hover:text-error",
							)}
						>
							{item.icon ? (
								<Icon name={item.icon} className="shrink-0 text-[16px]" />
							) : (
								<span className="w-4 shrink-0" />
							)}
							{item.label}
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}
