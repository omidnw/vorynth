import { useEffect, useState, type ReactNode } from "react";
import { useTextDirection } from "@/i18n";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { Icon } from "./Icon";

export interface ConfirmDialogProps {
	/** Show or hide the dialog. When false, nothing renders. */
	open: boolean;
	/** Dialog title (e.g. "Delete source?"). */
	title: string;
	/** Body text explaining the consequence (e.g. "3 saved stories will also be deleted."). */
	message: ReactNode;
	/** Called when the user confirms. */
	onConfirm: () => void;
	/** Called when the user cancels (button, Escape, or backdrop click). */
	onCancel: () => void;
	/** Label for the confirm button. Defaults to "Confirm". */
	confirmLabel?: string;
	/** Label for the cancel button. Defaults to "Cancel". */
	cancelLabel?: string;
	/** Material Symbols icon name shown in the header badge. Defaults to "warning". */
	icon?: string;
	/** Danger style — red accent for destructive actions (delete, purge). Defaults true. */
	danger?: boolean;
	/** Disable the confirm button (e.g. while a mutation is pending). */
	confirming?: boolean;
	/** Label override while confirming (e.g. "Deleting…"). */
	confirmingLabel?: string;
	/**
	 * When provided, shows a "Don't ask again" checkbox whose checked state is
	 * passed to `onConfirm(dontShowAgain)`. Mutually exclusive with passing a
	 * simple `onConfirm: () => void`.
	 */
	dontShowAgain?: boolean;
}

/**
 * Themed confirmation dialog — replaces native `window.confirm`.
 *
 * Matches the Vorynth design language: centered overlay with backdrop blur,
 * `surface-container` panel, `outline-variant` border, shared `Button`/
 * `Icon` components, full keyboard support (Escape cancels, Enter confirms),
 * and `role="alertdialog"` for screen readers.
 *
 * Destructive actions (delete, purge) use `danger` (default) — red icon badge
 * and red confirm button. Non-destructive confirmations pass `danger={false}`.
 *
 * **Never use `window.confirm` / `window.alert` / `window.prompt` in Vorynth** —
 * use this component instead (R-A12 in AGENTS.md).
 */
export function ConfirmDialog({
	open,
	title,
	message,
	onConfirm,
	onCancel,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	icon = "warning",
	danger = true,
	confirming = false,
	confirmingLabel,
	dontShowAgain = false,
}: ConfirmDialogProps) {
	const [dontShow, setDontShow] = useState(false);
	const textDir = useTextDirection();

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onCancel();
			if (e.key === "Enter" && !confirming) {
				e.preventDefault();
				handleConfirm();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, confirming, onCancel, dontShow]);

	// Reset the checkbox each time the dialog opens.
	useEffect(() => {
		if (open) setDontShow(false);
	}, [open]);

	if (!open) return null;

	const handleConfirm = () => {
		if (dontShowAgain) {
			(onConfirm as (dontShow: boolean) => void)(dontShow);
		} else {
			(onConfirm as () => void)();
		}
	};

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-[1px]"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="confirm-dialog-title"
			aria-describedby="confirm-dialog-message"
			onClick={(e) => {
				if (e.target === e.currentTarget) onCancel();
			}}
		>
			<div className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container p-6 shadow-2xl">
				<div className="mb-4 flex items-start gap-4">
					<span
						className={cn(
							"flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
							danger
								? "bg-error/10 text-error"
								: "bg-primary-container text-on-primary-container",
						)}
					>
						<Icon name={icon} fill className="text-[20px]" />
					</span>
					<div className="min-w-0">
						<h2
							id="confirm-dialog-title"
							className="font-headline text-headline-sm text-on-surface"
						>
							{title}
						</h2>
					</div>
				</div>

				<p
					id="confirm-dialog-message"
					className="mb-6 font-body text-body-md leading-relaxed text-on-surface-variant"
					dir={typeof message === "string" ? textDir(message) : "auto"}
				>
					{message}
				</p>

				{dontShowAgain ? (
					<label className="mb-4 flex cursor-pointer items-center gap-3">
						<input
							type="checkbox"
							checked={dontShow}
							onChange={(e) => setDontShow(e.target.checked)}
							className="h-4 w-4 accent-secondary"
						/>
						<span className="font-body text-body-sm text-on-surface-variant">
							Don&apos;t ask again
						</span>
					</label>
				) : null}

				<div className="flex justify-end gap-2">
					<Button variant="ghost" size="sm" onClick={onCancel}>
						{cancelLabel}
					</Button>
					<Button
						size="sm"
						icon={danger ? "delete" : "check"}
						onClick={handleConfirm}
						disabled={confirming}
						className={
							danger ? "bg-error text-on-error hover:brightness-105" : ""
						}
					>
						{confirming ? (confirmingLabel ?? "Working…") : confirmLabel}
					</Button>
				</div>
			</div>
		</div>
	);
}

// ── PromptDialog (replaces window.prompt) ───────────────────────────────────

export interface PromptDialogProps {
	open: boolean;
	title: string;
	message?: ReactNode;
	/** Initial value pre-filled in the input. */
	defaultValue?: string;
	/** Placeholder when empty. */
	placeholder?: string;
	/** Called with the trimmed value when the user submits (Enter or Save). */
	onSubmit: (value: string) => void;
	/** Called on cancel (button, Escape, or backdrop click). */
	onCancel: () => void;
	saveLabel?: string;
	cancelLabel?: string;
}

/**
 * Themed prompt dialog — replaces native `window.prompt`.
 *
 * Same visual language as {@link ConfirmDialog}, but with a text input.
 * Autofocuses the input on open and selects all text for quick overtype.
 * Enter submits, Escape cancels.
 */
export function PromptDialog({
	open,
	title,
	message,
	defaultValue = "",
	placeholder,
	onSubmit,
	onCancel,
	saveLabel = "Save",
	cancelLabel = "Cancel",
}: PromptDialogProps) {
	const [value, setValue] = useState(defaultValue);

	// Sync the input when the dialog opens or the default changes.
	useEffect(() => {
		if (open) setValue(defaultValue);
	}, [open, defaultValue]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onCancel();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onCancel]);

	if (!open) return null;

	const handleSubmit = () => {
		const trimmed = value.trim();
		if (trimmed) onSubmit(trimmed);
	};

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-[1px]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="prompt-dialog-title"
			onClick={(e) => {
				if (e.target === e.currentTarget) onCancel();
			}}
		>
			<div className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container p-6 shadow-2xl">
				<div className="mb-4 flex items-start gap-4">
					<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
						<Icon name="drive_file_rename_outline" className="text-[20px]" />
					</span>
					<div className="min-w-0 flex-1">
						<h2
							id="prompt-dialog-title"
							className="font-headline text-headline-sm text-on-surface"
						>
							{title}
						</h2>
						{message ? (
							<p className="mt-1 font-body text-body-sm text-on-surface-variant">
								{message}
							</p>
						) : null}
					</div>
				</div>

				<input
					autoFocus
					type="text"
					value={value}
					placeholder={placeholder}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							handleSubmit();
						}
					}}
					className="mb-6 w-full rounded border border-outline-variant bg-surface-container-low px-4 py-2.5 font-body text-body-md text-on-surface outline-none transition-colors focus:border-secondary"
				/>

				<div className="flex justify-end gap-2">
					<Button variant="ghost" size="sm" onClick={onCancel}>
						{cancelLabel}
					</Button>
					<Button
						size="sm"
						icon="check"
						onClick={handleSubmit}
						disabled={!value.trim()}
					>
						{saveLabel}
					</Button>
				</div>
			</div>
		</div>
	);
}
