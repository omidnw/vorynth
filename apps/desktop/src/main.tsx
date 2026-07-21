import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./app/App.js";
import { ErrorBoundary } from "./app/ErrorBoundary.js";
import { initTheme } from "./lib/theme/theme-store.js";
import { initLocale } from "./i18n/locale-store.js";
// Side-effect import: initializes the i18next instance (registers English).
import "./i18n/instance.js";
// Order matters: theme tokens must load before globals reference them.
import "./styles/theme.css";
import "./styles/globals.css";

// Apply persisted light/dark + RTL/LTR before first paint.
initTheme();
initLocale();

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<ErrorBoundary>
				<BrowserRouter>
					<App />
				</BrowserRouter>
			</ErrorBoundary>
		</QueryClientProvider>
	</StrictMode>,
);
