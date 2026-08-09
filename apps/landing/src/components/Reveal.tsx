import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fade-up on scroll via IntersectionObserver (degrades to visible). */
export function Reveal({
	children,
	delay,
	className,
}: {
	children: ReactNode;
	delay?: 1 | 2 | 3 | 4;
	className?: string;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (!("IntersectionObserver" in window)) {
			setVisible(true);
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						setVisible(true);
						observer.unobserve(entry.target);
					}
				}
			},
			{ threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const delayClass = delay ? ` reveal-delay-${delay}` : "";
	return (
		<div
			ref={ref}
			className={`reveal${visible ? " visible" : ""}${delayClass}${className ? ` ${className}` : ""}`}
		>
			{children}
		</div>
	);
}
