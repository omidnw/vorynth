import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, patchSettings } from "@/features/history/history-api";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useTranslation } from "react-i18next";

/**
 * "Support the author" reminder shown before the native reader.
 *
 * Vorynth reproduces the article body for focused reading, but the canonical
 * home of a story is the site that published it — that's where the author gets
 * credit, views, and ad revenue. So we nudge the reader to open the original,
 * while still letting them stay in-app if they prefer. Dismissable forever via
 * the "don't show again" checkbox; recoverable from Profile → Reader settings.
 *
 * Gated by the `reader.supportAuthorReminder` setting (default true). When the
 * setting is false this component renders nothing.
 */
export function SupportAuthorModal({
	articleUrl,
	articleTitle,
	onReadHere,
}: {
	articleUrl: string;
	articleTitle: string;
	/** Called when the user chooses to read in-app. */
	onReadHere: () => void;
}) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	const [dontShow, setDontShow] = useState(false);

	const { data: settings } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
	});
	const reminderOn = settings?.["reader.supportAuthorReminder"] ?? true;

	const dismissMutation = useMutation({
		mutationFn: (forever: boolean) =>
			forever
				? patchSettings({ "reader.supportAuthorReminder": false })
				: Promise.resolve(settings),
		onSettled: () =>
			queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
	});

	// Close on Escape.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onReadHere();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onReadHere]);

	if (!reminderOn) return null;

	const openOriginal = () => {
		if (dontShow) dismissMutation.mutate(true);
		window.open(articleUrl, "_blank", "noopener,noreferrer");
	};

	const readHere = () => {
		if (dontShow) dismissMutation.mutate(true);
		onReadHere();
	};

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6"
			role="dialog"
			aria-modal="true"
			aria-labelledby="support-author-title"
			onClick={(e) => {
				if (e.target === e.currentTarget) readHere();
			}}
		>
			<div className="w-full max-w-lg rounded-lg border border-outline-variant bg-surface-container p-8 shadow-2xl">
				<div className="mb-6 flex items-start gap-4">
					<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
						<Icon name="favorite" fill className="text-[24px]" />
					</span>
					<div>
						<h2
							id="support-author-title"
							className="mb-2 font-headline text-headline-md text-primary dark:text-primary-fixed"
						>
							{t("reader.supportTitle")}
						</h2>
						<p className="font-body text-body-md leading-relaxed text-on-surface-variant">
							{t("reader.supportBody")}
						</p>
					</div>
				</div>

				<div className="mb-6 rounded border border-outline-variant bg-surface-container-low p-4">
					<p className="mb-1 font-label text-label-sm uppercase tracking-widest text-on-tertiary-container">
						{t("reader.article")}
					</p>
					<p className="font-headline text-headline-sm leading-snug text-on-surface">
						{articleTitle}
					</p>
				</div>

				<div className="mb-6 flex flex-col gap-3 sm:flex-row">
					<Button className="flex-1" icon="open_in_new" onClick={openOriginal}>
						{t("reader.openOriginal")}
					</Button>
					<Button
						variant="secondary"
						className="flex-1"
						icon="menu_book"
						onClick={readHere}
					>
						{t("reader.readInVorynth")}
					</Button>
				</div>

				<label className="flex cursor-pointer items-center gap-3">
					<input
						type="checkbox"
						checked={dontShow}
						onChange={(e) => setDontShow(e.target.checked)}
						className="h-4 w-4 accent-secondary"
					/>
					<span className="font-body text-body-sm text-on-surface-variant">
						{t("reader.dontShowAgain")}{" "}
						<Link
							to="/profile"
							className="text-secondary underline-offset-2 hover:underline"
						>
							{t("reader.changeInProfile")}
						</Link>
					</span>
				</label>
			</div>
		</div>
	);
}
