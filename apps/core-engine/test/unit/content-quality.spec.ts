import {
	cleanCollectedText,
	hasHeadChrome,
	hasShellLeak,
	isContentCorrupted,
	needsParagraphRepair,
	needsShellRepair,
	translationIsIncomplete,
} from "../../src/modules/crawler/content-quality.js";

/**
 * Content-quality heuristics (v1.8.0) — the signals the health check and the
 * per-story Re-collect/Re-translate buttons use to spot damaged bodies and
 * incomplete translations.
 *
 * v1.8.0 tightening: only page-interface leaks count as damage. Legit content
 * that LOOKS like the old signals — {{mustache}} templates, "Posted in:"
 * footers, \uXXXX in code samples, generic "browser does not support X" prose —
 * must NOT be flagged.
 */
describe("isContentCorrupted", () => {
	it("flags inline JSON data blobs", () => {
		expect(
			isContentCorrupted(
				`Intro text { "play_video": "Play video", "pause_video": "Pause video" } more text`,
			),
		).toBe(true);
	});

	it("flags double-bracket template tokens (JS-shell leaks)", () => {
		expect(isContentCorrupted("Listen to article [[duration]] minutes")).toBe(
			true,
		);
		expect(isContentCorrupted("reading_time [[read-time]]")).toBe(true);
	});

	it("flags media-player chrome and the audio/video fallback", () => {
		expect(
			isContentCorrupted("Your browser does not support the audio element."),
		).toBe(true);
		expect(isContentCorrupted('{"play_video":"x"}')).toBe(true);
		expect(isContentCorrupted("pause_video enable_captions")).toBe(true);
	});

	it("accepts clean prose", () => {
		expect(
			isContentCorrupted(
				"Google released a bunch of new AI updates in July to make your devices smarter.",
			),
		).toBe(false);
		expect(isContentCorrupted("")).toBe(false);
	});

	// ── v1.8.0 tightening: legit content must not be flagged ────────────────

	it("does not flag {{mustache}} template syntax from tutorials", () => {
		expect(
			isContentCorrupted("Bind it with {{user.name}} or {{ items.length }}"),
		).toBe(false);
	});

	it("does not flag 'Posted in:' / newsletter footers", () => {
		expect(isContentCorrupted("Posted in: AI, Security, Cloud")).toBe(false);
		expect(isContentCorrupted("Sign up for our newsletters")).toBe(false);
	});

	it("does not flag \\uXXXX escapes printed in code samples", () => {
		expect(isContentCorrupted("Use \\u00e9 for an accented e.")).toBe(false);
	});

	it("does not flag generic 'browser does not support X' prose", () => {
		expect(
			isContentCorrupted("If your browser does not support WebP, use PNG."),
		).toBe(false);
	});

	it("does not flag short inline JSON examples (API docs)", () => {
		expect(isContentCorrupted('The response is {"a":1}.')).toBe(false);
	});
});

describe("translationIsIncomplete", () => {
	const original = "A".repeat(500);

	it("flags a missing translation", () => {
		expect(translationIsIncomplete(original, null)).toBe(true);
		expect(translationIsIncomplete(original, "")).toBe(true);
		expect(translationIsIncomplete(original, "   ")).toBe(true);
	});

	it("flags a truncated translation (implausibly short vs original)", () => {
		// 20 chars vs 500 → ~4% — clearly a partial translation.
		expect(translationIsIncomplete(original, "B".repeat(20))).toBe(true);
	});

	it("accepts a plausible-length translation", () => {
		expect(translationIsIncomplete(original, "ب".repeat(300))).toBe(false);
	});

	it("flags leftover double-bracket tokens or escaped unicode", () => {
		expect(
			translationIsIncomplete(original, "B".repeat(400) + " [[read-time]]"),
		).toBe(true);
		expect(
			translationIsIncomplete(original, "B".repeat(400) + " \\u2019"),
		).toBe(true);
	});

	it("does not flag {{mustache}} inside a translation", () => {
		expect(
			translationIsIncomplete(original, "B".repeat(400) + " {{user.name}}"),
		).toBe(false);
	});

	it("treats a short original as translatable without length judgement", () => {
		expect(translationIsIncomplete("Short title", "کوتاه")).toBe(false);
	});

	it("does not flag a translation when there is no original to translate", () => {
		expect(translationIsIncomplete("", "Whatever")).toBe(false);
	});
});

describe("hasShellLeak (Cloudflare-blog page shell)", () => {
	it("flags a body carrying the Cloudflare byline/share-button shell", () => {
		expect(
			hasShellLeak(
				"BlogAgentsAgents WeekAI+4Show 4 more tags7 TagsShow 7 tagsAugust 5, 2026The Agent Access ModelMatt Silverlock26 minute readCOPY URLFor the last twelve years...",
			),
		).toBe(true);
	});

	it("accepts clean prose and reading-time phrases without the shell", () => {
		expect(hasShellLeak("Clean article prose about enterprise security.")).toBe(
			false,
		);
		expect(hasShellLeak("This is a 5 minute read about Kubernetes.")).toBe(
			false,
		);
		expect(hasShellLeak("")).toBe(false);
	});

	it("flags an AWS-style metadata header (Permalink Comments Share)", () => {
		expect(
			hasShellLeak(
				"Amazon DynamoDB now supports vector search at any scale by Esra Kayabali on 05 AUG 2026 in Amazon DynamoDB, Announcements, Database, Generative AI Permalink Comments Share Today, we're announcing...",
			),
		).toBe(true);
	});
});

describe("needsShellRepair (flattened Cloudflare prose → one-time re-extract)", () => {
	const shell = (body: string) =>
		`BlogAgentsAgents WeekAugust 5, 2026TitleMatt Silverlock7 minute readCOPY URL${body}Follow on Social MediaCloudflareSubscribe to receive notifications of new posts`;

	it("flags a shell-leak body captured before the paragraph-break fix", () => {
		expect(
			needsShellRepair(
				shell("For the last twelve years enterprise security has moved away."),
			),
		).toBe(true);
	});

	it("does not re-flag a body that already carries paragraph breaks", () => {
		expect(
			needsShellRepair(
				shell(
					"For the last twelve years.\n\nBeyondCorp removed implicit trust.",
				),
			),
		).toBe(false);
	});

	it("accepts clean prose and empty content", () => {
		expect(needsShellRepair("Just a normal article body.")).toBe(false);
		expect(needsShellRepair("")).toBe(false);
	});
});

describe("needsParagraphRepair (long flattened bodies → one-time re-extract)", () => {
	it("flags a long body with no paragraph breaks", () => {
		expect(needsParagraphRepair("x".repeat(2000))).toBe(true);
	});

	it("accepts bodies with paragraph breaks or short bodies", () => {
		expect(
			needsParagraphRepair("para one.\n\npara two.\n\n" + "y".repeat(2000)),
		).toBe(false);
		expect(needsParagraphRepair("Short snippet.")).toBe(false);
		expect(needsParagraphRepair("")).toBe(false);
	});
});

describe("hasHeadChrome (flattened metadata before the title)", () => {
	const title = "How we built a realtime system for responsive voice AI";
	it("flags flattened date/category chips that precede the title", () => {
		expect(
			hasHeadChrome(
				`August 3, 2026EngineeringCompany${title} in six monthsBy Justin Uberti`,
				title,
			),
		).toBe(true);
	});

	it("accepts a body that starts with its title or lacks it", () => {
		expect(
			hasHeadChrome(`${title} — the realtime system came together.`, title),
		).toBe(false);
		expect(hasHeadChrome("Clean prose with no title in the body.", title)).toBe(
			false,
		);
		expect(hasHeadChrome("", title)).toBe(false);
		expect(hasHeadChrome("Some body", null)).toBe(false);
	});
});

describe("cleanCollectedText (read-time cleanup)", () => {
	it("turns the Google-blog junk into readable prose", () => {
		const junk = `{ "reading_time": "[[read\\u002Dtime]] min read" } Breadcrumb Home Innovation & AI Technology AI The latest AI news we announced in July 2026 Aug 04, 2026 | x.com Facebook LinkedIn Mail Copy link Here's a recap of some of our biggest AI updates from July. News from Google Team Share x.com Facebook LinkedIn Mail Copy link { "play_video": "Play video", "pause_video": "Pause video", "mute": "Click to mute audio" } Your browser does not support the audio element. Listen to article [[duration]] minutes This content is generated by Google AI. Generative AI is experimental Voice Speed 0.75X 1X 1.5X 2X Read AI-generated summary Get the latest news from Google in your inbox Sign up for our newsletters POSTED IN: AI Gemini models`;
		const clean = cleanCollectedText(
			junk,
			"The latest AI news we announced in July 2026",
		);
		expect(clean).toContain("The latest AI news we announced in July 2026");
		expect(clean).toContain("Here's a recap of some of our biggest AI updates");
		expect(clean).not.toContain("play_video");
		expect(clean).not.toContain("[[");
		expect(clean).not.toContain("Breadcrumb");
		expect(clean).not.toContain("browser does not support");
		expect(clean).not.toContain("POSTED IN:");
		expect(clean).not.toContain("Sign up for our newsletters");
		// The leading breadcrumb/share prefix before the title is dropped.
		expect(clean.startsWith("The latest AI news")).toBe(true);
	});

	it("leaves clean prose unchanged (modulo whitespace)", () => {
		const prose =
			"Google released a bunch of new AI updates in July to make your devices smarter.";
		expect(cleanCollectedText(prose)).toBe(prose);
	});

	it("strips JSON blobs and template tokens even without a title", () => {
		const t = cleanCollectedText(
			'Intro { "reading_time": "[[read-time]] min read" } body text',
		);
		expect(t).toContain("Intro body text");
		expect(t).not.toContain("[[");
		expect(t).not.toContain("{");
	});

	it("turns the Cloudflare-blog shell into the article's prose", () => {
		const shell = `BlogAgentsAgents WeekAI+4Show 4 more tags7 TagsShow 7 tagsSelected TagsAgentsAgents WeekAIIdentityProduct NewsSASEZero TrustAll tagsMatching tagsNo tags found1.1.1.12FAAbuseAccessAccess Control Lists (ACLs)AccessibilityAugust 5, 2026The Agent Access ModelMatt Silverlock26 minute readCOPY URLFor the last twelve years, enterprise security has moved away from trusting the network. BeyondCorp made the case that a request's origin, inside the corporate perimeter, no longer implies trust. This paper proposes an access model for agents: the Agent Access Model (AAM).Follow on Social MediaCloudflareMatt SilverlockSubscribe to receive notifications of new postsEmail addressWe'll never share your email address.SubscribeThanks for subscribing! Check your inbox to confirm.`;
		const clean = cleanCollectedText(shell, "The Agent Access Model");
		// The prose survives, starting at its first sentence.
		expect(clean.startsWith("For the last twelve years")).toBe(true);
		expect(clean).toContain("proposes an access model for agents");
		// The nav/tag dump, byline share button, and newsletter footer are gone.
		expect(clean).not.toContain("BlogAgents");
		expect(clean).not.toContain("COPY URL");
		expect(clean).not.toContain("minute read");
		expect(clean).not.toContain("On this page");
		expect(clean).not.toContain("Discuss Online");
		expect(clean).not.toContain("Follow on Social Media");
		expect(clean).not.toContain("Subscribe to receive notifications");
		expect(clean).not.toContain("never share your email");
	});

	it("also strips the trailing On this page / Related tags chrome", () => {
		const shell = `August 2, 2026Welcome to Agents WeekRita Kozlov3 minute readCOPY URLThis post is also available in English, 中文, 日本語, 한국어.On this pageDiscuss OnlineRelated tagsAgentsAgents WeekAIWorkersFollow on Social MediaCloudflareRita KozlovSubscribe to receive notifications of new postsEmail addressWe'll never share your email address.SubscribeThanks for subscribing! Check your inbox to confirm.`;
		const clean = cleanCollectedText(shell, "Welcome to Agents Week");
		expect(clean.startsWith("This post is also available in English")).toBe(
			true,
		);
		expect(clean).toContain("中文");
		expect(clean).not.toContain("On this page");
		expect(clean).not.toContain("Related tags");
		expect(clean).not.toContain("Subscribe to receive");
	});

	it("leaves a Cloudflare-free body untouched by the shell cuts", () => {
		const prose =
			"Cloudflare explains how its network routes 1.1.1.1 DNS queries across the globe.";
		expect(cleanCollectedText(prose)).toBe(prose);
	});

	it("keeps paragraph breaks through the shell cleanup", () => {
		const shell = `August 5, 2026The Agent Access ModelMatt Silverlock26 minute readCOPY URLFor the last twelve years, enterprise security has moved away from trusting the network.\n\nSet the ground rules\n\nWe started by defining a set of principles.Follow on Social MediaCloudflareMatt SilverlockSubscribe to receive notifications of new posts`;
		const clean = cleanCollectedText(shell, "The Agent Access Model");
		expect(clean.startsWith("For the last twelve years")).toBe(true);
		expect(clean).toContain("network.\n\nSet the ground rules");
		expect(clean).toContain("ground rules\n\nWe started");
		expect(clean).not.toContain("COPY URL");
		expect(clean).not.toContain("Follow on Social Media");
	});

	it("strips the AWS metadata header and comments stub", () => {
		const aws = `Amazon DynamoDB now supports vector search at any scale by Esra Kayabali on 05 AUG 2026 in Amazon DynamoDB, Announcements, Database, Generative AI Permalink Comments Share Today, we're announcing the general availability of vector search in Amazon DynamoDB. You can store vector embeddings alongside your operational data.\n\n— Esra Esra Kayabali Esra Kayabali is a Principal Solutions Architect at AWS, specializing in analytics. Loading comments…`;
		const clean = cleanCollectedText(
			aws,
			"Amazon DynamoDB now supports vector search at any scale",
		);
		expect(clean.startsWith("Today, we're announcing")).toBe(true);
		expect(clean).toContain("store vector embeddings alongside");
		expect(clean).not.toContain("Permalink");
		expect(clean).not.toContain("Comments Share");
		expect(clean).not.toContain("Loading comments");
	});

	it("cuts OpenAI-style head metadata and the related-articles footer", () => {
		const title = "How we built a realtime system for responsive voice AI";
		const openai = `August 3, 2026EngineeringCompany${title} in six monthsBy Justin UbertiThe realtime system came together in six months of focused work on streaming inference.Keep readingView allApple is getting this wrongCompanyAug 3, 2026`;
		const clean = cleanCollectedText(openai, title);
		expect(clean.startsWith(title)).toBe(true);
		expect(clean).toContain("six months of focused work");
		expect(clean).not.toContain("Engineering");
		expect(clean).not.toContain("Keep reading");
		expect(clean).not.toContain("Apple is getting this wrong");
	});

	it("cuts Smashing-style read-time label and promo footer", () => {
		const title =
			"Small Joys And Big Adventures (August 2026 Wallpapers Edition)";
		const smashing = `Cosima MielkeJul 31, 20260 comments${title}11 min readWallpaperThis month we are sharing a new set of wallpapers with you.Get Featured Next MonthFeeling inspired? We'll publish the September wallpapers on August 31.Explore more onWallpapersSmashing NewsletterTips on front-end & UX`;
		const clean = cleanCollectedText(smashing, title);
		expect(clean.startsWith(title)).toBe(true);
		expect(clean).toContain("sharing a new set of wallpapers");
		expect(clean).not.toContain("11 min read");
		expect(clean).not.toContain("Get Featured Next Month");
		expect(clean).not.toContain("Explore more on");
	});

	it("cuts the POSTED IN tag tail on Google-style bodies", () => {
		const google = `Breadcrumb Home AI The latest AI news we announced in July 2026 Here's a recap of our biggest AI updates. POSTED IN: AI Gemini models Google DeepMind Search`;
		const clean = cleanCollectedText(
			google,
			"The latest AI news we announced in July 2026",
		);
		expect(clean).toContain("Here's a recap of our biggest AI updates");
		expect(clean).not.toContain("POSTED IN:");
		expect(clean).not.toContain("Google DeepMind");
	});
});
