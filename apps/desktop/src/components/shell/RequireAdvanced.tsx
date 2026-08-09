import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchSettings } from "@/features/history/history-api.js";

/**
 * Route guard for the advanced-features surface (v1.8.0). The Plugins page is
 * power-user territory — when "Show advanced features" is off (the default),
 * a direct visit to `/plugins` redirects home instead of revealing plugin
 * machinery to someone who never asked for it. Renders nothing while settings
 * load so the redirect doesn't flash.
 */
export function RequireAdvanced({ children }: { children: ReactNode }) {
	const { data: settings, isLoading } = useQuery({
		queryKey: ["app-settings"],
		queryFn: fetchSettings,
		staleTime: 60_000,
	});

	if (isLoading) return null;
	if (settings?.["ui.showAdvancedFeatures"] !== true) {
		return <Navigate to="/" replace />;
	}
	return <>{children}</>;
}
