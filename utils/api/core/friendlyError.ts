import { getSyncTranslation } from "@/utils/toast_translations";
import { inferFieldFromMessage, sanitizeValidationText } from "./fieldErrors";

export type FriendlyErrorKind = "offline" | "server" | "timeout" | "auth" | "forbidden" | "rate_limited" | "validation" | "not_found" | "unknown";
export interface FriendlyError { kind: FriendlyErrorKind; title: string; message: string; retryable: boolean }

let deviceConnected: boolean | null = null;
export const setDeviceConnected = (connected: boolean) => { deviceConnected = connected; };
export const setDeviceOnline = setDeviceConnected;

const extractRawText = (value: unknown): { text?: string; isFieldValidation: boolean } => {
	if (typeof value === "string") {
		return { text: value, isFieldValidation: Boolean(inferFieldFromMessage(value)) };
	}
	if (Array.isArray(value)) {
		const joined = value
			.map((v) => (typeof v === "string" ? v : v?.msg ?? v?.message))
			.filter((v) => typeof v === "string")
			.join(" ");
		return { text: joined || undefined, isFieldValidation: true };
	}
	if (value && typeof value === "object") {
		const anyVal = value as any;
		if (Array.isArray(anyVal.errors) && anyVal.errors.length > 0) {
			const first = anyVal.errors[0];
			const firstMsg = first?.message ?? first?.msg;
			if (typeof firstMsg === "string") {
				return { text: firstMsg, isFieldValidation: true };
			}
		}
		if (typeof anyVal.message === "string") {
			return { text: anyVal.message, isFieldValidation: Boolean(inferFieldFromMessage(anyVal.message)) };
		}
		if (typeof anyVal.detail === "string") {
			return { text: anyVal.detail, isFieldValidation: Boolean(inferFieldFromMessage(anyVal.detail)) };
		}
		if (typeof anyVal.msg === "string") {
			return { text: anyVal.msg, isFieldValidation: true };
		}
	}
	return { text: undefined, isFieldValidation: false };
};

const safeServerText = (
	value: unknown,
	options?: { allowFieldValidation?: boolean; maxLength?: number },
): string | undefined => {
	const { text, isFieldValidation } = extractRawText(value);
	if (!text) return undefined;
	return sanitizeValidationText(text, {
		allowCooldownKeywords: Boolean(options?.allowFieldValidation && isFieldValidation),
		maxLength: options?.maxLength ?? 200,
	});
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

	if (status === 413) {
		const data = err?.response?.data ?? err?.data;
		const serverMsg =
			safeServerText(data?.detail, { allowFieldValidation: true, maxLength: 200 }) ??
			safeServerText(err?.detail, { allowFieldValidation: true, maxLength: 200 }) ??
			safeServerText(data?.message, { allowFieldValidation: true, maxLength: 200 });
		return {
			kind: "validation",
			title: getSyncTranslation("alert", "Alert"),
			message: serverMsg ?? getSyncTranslation("errPayloadTooLarge", "Photo size is too large. Please retake the photo."),
			retryable: true,
		};
	}

	if (status === 400 || status === 422) {
		const data = err?.response?.data ?? err?.data;
		const serverMsg =
			safeServerText(data?.detail, { allowFieldValidation: true, maxLength: 200 }) ??
			safeServerText(err?.detail, { allowFieldValidation: true, maxLength: 200 }) ??
			safeServerText(data?.errors, { allowFieldValidation: true, maxLength: 200 }) ??
			safeServerText(data?.message, { allowFieldValidation: true, maxLength: 200 });
		return {
			kind: "validation",
			title: getSyncTranslation("errValidationGeneric", "Unable to submit"),
			message: serverMsg ?? getSyncTranslation("errValidationGeneric", "Please check your information and try again."),
			retryable: false,
		};
	}

	if (status === 404) {
		const data = err?.response?.data ?? err?.data;
		const serverMsg =
			safeServerText(data?.detail) ??
			safeServerText(err?.detail) ??
			safeServerText(data?.message);
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

