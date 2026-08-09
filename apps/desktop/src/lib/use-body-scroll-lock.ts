import { useEffect } from "react";

/**
 * Lock the page scroll while a modal overlay is open.
 *
 * Full-screen dialogs are rendered inline (not portals), so without this the
 * page behind a `fixed inset-0` overlay still scrolls with the wheel/trackpad —
 * the classic "the page scrolls under the modal" bug. The previous overflow
 * value is restored on unmount (and when `active` flips off).
 */
export function useBodyScrollLock(active = true) {
	useEffect(() => {
		if (!active) return;
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [active]);
}
