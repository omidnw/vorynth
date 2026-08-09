import { clsx, type ClassValue } from "clsx";

/** Conditional className combiner. */
export function cn(...inputs: ClassValue[]): string {
	return clsx(inputs);
}
