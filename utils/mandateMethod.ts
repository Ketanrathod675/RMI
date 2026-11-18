import type { MandateMethod, MandateTypeResponse } from "./api/services/autocollect.service";

/**
 * Pure helper to derive mandate method from mandate type response.
 * Fallback to eNACH if backend reports fallback_to_enach === true, else default to "upi".
 */
export function getMandateMethod(typeData?: MandateTypeResponse["data"] | null): MandateMethod {
	if (!typeData) return "upi";
	return typeData.fallback_to_enach === true ? "enach" : "upi";
}

/**
 * Formats account last 4 digits as "•••• 1234".
 * If last4 is null, empty, or undefined, returns "".
 */
export function formatAccountTail(last4?: string | null): string {
	if (!last4 || !String(last4).trim()) return "";
	return `•••• ${String(last4).trim()}`;
}
