import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath, URL } from "node:url";

/**
 * Storybook for the desktop app — component + page stories with mock data.
 *
 * Reuses the app's Vite setup (react plugin + `@` alias) so stories resolve
 * imports exactly like the app. The docs page's interactive demos reuse these
 * stories' mock data (see `/docs-update` skill).
 */
const config: StorybookConfig = {
	stories: ["../src/**/*.stories.tsx"],
	addons: [],
	framework: {
		name: "@storybook/react-vite",
		options: {},
	},
	async viteFinal(vite) {
		vite.resolve ??= {};
		vite.resolve.alias ??= {};
		(vite.resolve.alias as Record<string, string>)["@"] = fileURLToPath(
			new URL("../src", import.meta.url),
		);
		return vite;
	},
};

export default config;
