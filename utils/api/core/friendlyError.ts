import { getSyncTranslation } from "@/utils/toast_translations";

export type FriendlyErrorKind = "offline" | "server" | "timeout" | "auth" | "forbidden" | "rate_limited" | "validation" | "not_found" | "unknown";
export interface FriendlyError { kind: FriendlyErrorKind; title: string; message: string; retryable: boolean }

let deviceConnected: boolean | null = null;
export const setDeviceConnected = (connected: boolean) => { deviceConnected = connected; };
export const setDeviceOnline = setDeviceConnected;

const safeServerText = (value: unknown): string | undefined => {
	let text: string | undefined;
	if (typeof value === "string") text = value;
	else if (Array.isArray(value)) text = value.map((v) => typeof v === "string" ? v : v?.msg).filter((v) => typeof v === "string").join(" ");
	else if (value && typeof value === "object") text = typeof (value as any).msg === "string" ? (value as any).msg : undefined;
	if (!text || text.length > 140 || /traceback|exception|\bsql\b|psycopg|keyerror|<html|\bat\s+[\w$.<>]+\s+\([^)]*:\d+:\d+\)/i.test(text)) return undefined;
	return text;
};

export function getFriendlyError(error: unknown): FriendlyError {
	const err = error as any;
	const status = err?.response?.status ?? err?.status;
	const timeout = err?.code === "ECONNABORTED" || err?.code === "ETIMEDOUT" || /timeout/i.test(String(err?.message ?? ""));

	if (timeout) {
		return {
			kind: "timeout",
			title: getSyncTranslation("errTimeout", "Request timed out"),
			message: getSyncTranslation("errTimeout", "This is taking longer than usual. Please try again."),
			retryable: true,
		};
	}

	// Offline wording used ONLY when isConnected is explicitly false
	if (!err?.response && (err?.kind === "offline" || err?.isConnected === false || deviceConnected === false)) {
		return {
			kind: "offline",
			title: getSyncTranslation("noInternetConnection", "No internet connection"),
			message: getSyncTranslation("errOffline", "No internet connection"),
			retryable: true,
		};
	}

	// Request failed without response while connected is true -> server reachability issue
	if (!err?.response && (err?.code === "ERR_NETWORK" || err?.isAxiosError)) {
		return {
			kind: "server",
			title: getSyncTranslation("connectionProblem", "Connection problem"),
			message: getSyncTranslation("errServer", "We can't reach our servers right now. Your data is safe. Please try again in a moment."),
			retryable: true,
		};
	}

	if (status === 401) {
		return {
			kind: "auth",
			title: getSyncTranslation("errAuth", "Session expired"),
			message: getSyncTranslation("errAuth", "Please sign in again to continue."),
			retryable: false,
		};
	}

	if (status === 403) {
		return {
			kind: "forbidden",
			title: getSyncTranslation("errForbidden", "Access denied"),
			message: getSyncTranslation("errForbidden", "You don't have access to this action."),
			retryable: false,
		};
	}

	if (status === 429) {
		return {
			kind: "rate_limited",
			title: getSyncTranslation("errRateLimited", "Please wait"),
			message: getSyncTranslation("errRateLimited", "Too many attempts. Please wait a moment and try again."),
			retryable: true,
		};
	}

	if (status >= 500) {
		return {
			kind: "server",
			title: getSyncTranslation("errServer", "Server unavailable"),
			message: getSyncTranslation("errServer", "We're having trouble on our side. Your data is safe. Please try again shortly."),
			retryable: true,
		};
	}

	if (status === 400 || status === 422) {
		const serverMsg = safeServerText(err?.response?.data?.detail) ?? safeServerText(err?.response?.data?.message);
		return {
			kind: "validation",
			title: getSyncTranslation("errValidationGeneric", "Unable to submit"),
			message: serverMsg ?? getSyncTranslation("errValidationGeneric", "Please check your information and try again."),
			retryable: false,
		};
	}

	if (status === 404) {
		const serverMsg = safeServerText(err?.response?.data?.detail) ?? safeServerText(err?.response?.data?.message);
		return {
			kind: "not_found",
			title: getSyncTranslation("errNotFound", "Not found"),
			message: serverMsg ?? getSyncTranslation("errNotFound", "We couldn't find the requested information."),
			retryable: false,
		};
	}

	return {
		kind: "unknown",
		title: getSyncTranslation("errGeneric", "Something went wrong"),
		message: getSyncTranslation("errGeneric", "Something went wrong. Please try again."),
		retryable: true,
	};
}

