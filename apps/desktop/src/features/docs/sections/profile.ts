import type { DocsSection } from "../types.js";

/** Profile — identity, custom instruction, AI language, and reader preferences. */
export const profileSection: DocsSection = {
	id: "profile",
	title: "Profile",
	summary:
		"Who you are, how the AI should answer, and your reader preferences.",
	icon: "account_circle",
	pageRoute: "/profile",
	blocks: [
		{
			type: "paragraph",
			text: "The Profile page is where Vorynth learns about you. It holds your identity, a custom instruction that shapes how the AI writes, the language it answers in, and the reader preferences that adjust the article reading experience. The sections are grouped into categories — Who you are, How the AI writes, Languages, and Reading — with a category rail (or chips on narrow screens) that anchors to each group and a search box that filters them; every option stays visible.",
		},
		{
			type: "flow",
			title: "How the AI gets to know you",
			steps: [
				{ icon: "edit_note", label: "Write instruction" },
				{ icon: "auto_awesome", label: "Generate summary" },
				{ icon: "interests", label: "Derive interests" },
				{ icon: "chat", label: "Better answers" },
			],
		},
		{
			type: "features",
			items: [
				{
					icon: "account_circle",
					label: "Identity",
					text: "Your display name — first name, last name, or an alias. It appears in your reports and across the app; there is no free-text bio field.",
				},
				{
					icon: "edit_note",
					label: "Custom instruction",
					text: "A free-form instruction (\"Write short, assume I'm a senior engineer…\") that steers the style and depth of AI output. You can improve it with the 'improve' action.",
				},
				{
					icon: "auto_awesome",
					label: "Behavior summary",
					text: "A short summary of how the AI should write for you, generated from your instruction together with your search and briefing history — a readable check of what Vorynth thinks you want.",
				},
				{
					icon: "interests",
					label: "Interests",
					text: "Read-only, derived from the themes of your saved briefings and your recent searches — shown so you can see what the system believes you care about.",
				},
				{
					icon: "translate",
					label: "Language",
					text: "Two separate searchable dropdowns. The UI language (how the app is written) ships in 10 bundled languages — English, فارسی, العربية, 한국어, 日本語, 中文, עברית, Español, Deutsch, Русский — plus any language you add by exporting the English catalog, translating it, and importing it back. The AI language is the language Vorynth answers in. Type a name or code to filter either list.",
				},
				{
					icon: "menu_book",
					label: "Reader preferences",
					text: "Toggles that shape the reading experience: the support-author reminder in the article reader, and whether locally-kept media is the default for new articles.",
				},
				{
					icon: "more_vert",
					label: "Reader actions",
					text: "Choose which story actions stay in the reader's bottom bar — Mark read, Save, Re-collect, Share, Export, Open original, Back. Everything else moves behind the 'More ⋮' menu; nothing is hidden, and you can pin any action you reach for often (even Export).",
				},
				{
					icon: "gesture",
					label: "Card click",
					text: "Whether dragging the mouse across a story card selects the text (and does NOT open the story) or opens the story right away. On by default — a clean click is required to open. Turn it off if you never select text with the mouse and want any press-release to open the story.",
				},
			],
		},
		{
			type: "bullets",
			items: [
				"The UI language and the AI answer language are independent — the app can be in English while answers come in Persian (or vice versa).",
				'Both language dropdowns are searchable — type the native name, the English name, or the code (e.g. "Persian", "فارسی", or "fa") to filter.',
				"Language moved here from Settings; Settings links to Profile so the switch is always findable.",
				"Confirmation-dialog behavior (e.g. the provider-delete prompt) is also managed from here.",
				"App-level configuration (mode, provider, retention) stays on the Settings page.",
			],
		},
	],
};
