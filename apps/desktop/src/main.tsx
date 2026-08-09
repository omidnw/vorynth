import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./app/App.js";
import { ErrorBoundary } from "./app/ErrorBoundary.js";
import { PluginHostProvider } from "./plugins/PluginHostProvider.js";
import { initTheme } from "./lib/theme/theme-store.js";
import { initLocale } from "./i18n/locale-store.js";
import { initCoreBaseUrl } from "./lib/api/config.js";
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

// Resolve the engine port before the UI mounts: in the packaged app the Tauri
// shell may have picked a port other than the default 34117 (v1.8.0), and every
// request must target that port from the very first render.
async function bootstrap() {
	await initCoreBaseUrl();
	createRoot(document.getElementById("root")!).render(
		<StrictMode>
			<QueryClientProvider client={queryClient}>
				<ErrorBoundary>
					<BrowserRouter>
						{/* Installs window.__VORYNTH_HOST__ + loads enabled UI plugins. */}
						<PluginHostProvider>
							<App />
						</PluginHostProvider>
					</BrowserRouter>
				</ErrorBoundary>
			</QueryClientProvider>
		</StrictMode>,
	);
}

void bootstrap();
