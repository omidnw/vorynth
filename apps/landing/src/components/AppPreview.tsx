import { useEffect, useMemo } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShellLayout } from "@/app/ShellLayout";
import { BriefPage } from "@/pages/BriefPage";
import { useThemeStore } from "@/lib/theme/theme-store.js";
import { useTheme } from "../theme";

/**
 * The landing page's "preview" is the REAL desktop Today's Brief screen:
 * `ShellLayout` (sidebar + top bar) wrapping `BriefPage` — the same components
 * the app renders, with the engine replaced by a static mock (`mock-engine.ts`).
 * Tailwind (configured to scan desktop src) compiles their utility classes.
 *
 * Theme: the preview follows the landing page's theme. The desktop theme-store
 * and the landing's useTheme both drive `.dark` on the shared <html>; this
 * bridge keeps the two stores in sync so the page toggle and the preview's own
 * toggle agree in both directions.
 */
export function AppPreview() {
	const queryClient = useMemo(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 60_000,
						refetchOnWindowFocus: false,
						retry: 0,
					},
				},
			}),
		[],
	);

	// ── Theme bridge: landing theme ⇄ desktop theme-store ───────────────
	const { theme, setTheme } = useTheme();

	// Landing → desktop store (keeps the preview's toggle icon in sync).
	useEffect(() => {
		useThemeStore.setState({ theme });
	}, [theme]);

	// Desktop store → landing (the preview's own toggle flips the whole page).
	useEffect(() => {
		const unsub = useThemeStore.subscribe((state, prev) => {
			if (state.theme === prev.theme) return;
			// The desktop store may hold a plugin theme id; only the built-in
			// light/dark map onto the landing page's theme.
			if (state.theme === "dark" || state.theme === "light")
				setTheme(state.theme);
		});
		return unsub;
	}, [setTheme]);

	return (
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={["/brief"]}>
				<Routes>
					<Route element={<ShellLayout />}>
						<Route path="/brief" element={<BriefPage />} />
						<Route path="*" element={<BriefPage />} />
					</Route>
				</Routes>
			</MemoryRouter>
		</QueryClientProvider>
	);
}
