import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import {
	Architecture,
	AudienceSection,
	CtaSection,
	FaqSection,
	Features,
	Footer,
	HowItWorks,
	Modes,
	NotAiSection,
	OriginSection,
	Platforms,
	StatsSection,
	WhySection,
} from "./components/sections";

export function App() {
	return (
		<>
			<Nav />
			<Hero />
			<main>
				<OriginSection />
				<WhySection />
				<NotAiSection />
				<HowItWorks />
				<AudienceSection />
				<Features />
				<Modes />
				<StatsSection />
				<Architecture />
				<Platforms />
				<CtaSection />
				<FaqSection />
			</main>
			<Footer />
		</>
	);
}
