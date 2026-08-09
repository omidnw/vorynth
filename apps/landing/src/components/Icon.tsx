/** Material Symbols icon — the landing page's only icon source (same as the app). */
export function Icon({ name, size }: { name: string; size?: number }) {
	return (
		<span className="icon" style={size ? { fontSize: size } : undefined}>
			{name}
		</span>
	);
}
