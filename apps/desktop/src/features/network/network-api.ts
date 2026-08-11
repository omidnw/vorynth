import { apiFetch } from "@/lib/api/config";
import type { NetworkInfo } from "@vorynth/types";

/**
 * Engine network access (v1.8.1 — Settings → Advanced → Developer).
 * Settings themselves are read/written via GET/PATCH /settings; this endpoint
 * only reports the RESOLVED view (listening host, port, detected LAN IPs).
 */
export function fetchNetworkInfo(): Promise<NetworkInfo> {
	return apiFetch<NetworkInfo>("/network");
}
