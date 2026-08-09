import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Root } from "./Root";
import { installMockEngine } from "./mock-engine";

// Self-host Material Symbols so icons render where Google Fonts is unreachable
// (same package the desktop app ships). Text faces still come from the Google
// Fonts <link> in index.html.
import "@fontsource/material-symbols-outlined/400.css";

// Register the real desktop English catalog (i18next side-effect). The preview
// renders the actual desktop ShellLayout + BriefPage, which use real t() keys.
import "@/i18n/instance.js";
import { useLocaleStore } from "@/i18n/locale-store.js";

// The preview renders the real desktop UI — pin it to English no matter what
// this origin has persisted locally, so visitors always see the app in English.
useLocaleStore.getState().setActive("en");

// Mock the engine BEFORE React mounts so every apiFetch in the preview
// resolves to static data instead of localhost:34117.
installMockEngine();

// Order matters: theme tokens must load before the desktop Tailwind globals
// that reference them, and before the landing's own layout styles.
import "./theme.css";
import "@/styles/globals.css";
import "./site.css";
import "./preview.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
	<StrictMode>
		<Root />
	</StrictMode>,
);
