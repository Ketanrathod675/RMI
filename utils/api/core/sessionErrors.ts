/**
 * Session Error Codes & Diagnostic Helpers
 * Used for Single Device Session Management.
 */

// Must match the backend (app/core/session.py -> CODE_ACTIVE_SESSION_ON_ANOTHER_DEVICE).
export const ACTIVE_SESSION_ON_ANOTHER_DEVICE = "ACTIVE_SESSION_ON_ANOTHER_DEVICE";
export const ACTIVE_SESSION_CONFLICT_CODE = ACTIVE_SESSION_ON_ANOTHER_DEVICE;
// Legacy aliases kept so older backend builds still trigger the popup.
export const ACTIVE_SESSION_EXISTS = "ACTIVE_SESSION_EXISTS";
export const ACTIVE_SESSION_CONFLICT = "ACTIVE_SESSION_CONFLICT";

export const SESSION_REPLACED_CODE = "SESSION_REPLACED";
export const SESSION_REPLACED = "SESSION_REPLACED";

export interface ApiErrorDetail {
	code?: string;
	message?: string;
	device_name?: string;
	existing_device_name?: string;
	logged_in_at?: string | null;
	[key: string]: any;
}

/**
 * Extracts structured detail object from any API error (FastAPI HTTPExceptions, Axios errors, etc.).
 */
export function getApiErrorDetail(error: any): ApiErrorDetail | null {
	if (!error) return null;
	const data = error?.response?.data ?? error?.data ?? error;
	if (!data) return null;

	if (typeof data.detail === "object" && data.detail !== null) {
		return data.detail;
	}
	if (data.code || data.device_name || data.existing_device_name) {
		return data;
	}
	if (typeof data.detail === "string") {
		return { message: data.detail };
	}
	if (typeof data.message === "string") {
		return { message: data.message };
	}
	return null;
}

/**
 * Extracts error code string from an API error.
 */
export function getApiErrorCode(error: any): string | null {
	if (!error) return null;
	const detail = getApiErrorDetail(error);
	const data = error?.response?.data ?? error?.data ?? error;

	return (
		detail?.code ||
		data?.code ||
		data?.error_code ||
		data?.error ||
		(typeof data?.detail === "string" ? data.detail : null) ||
		null
	);
}

/**
 * Checks if the error represents an active session conflict (user already logged in on another device).
 */
export function isSessionConflictError(error: any): boolean {
	const code = getApiErrorCode(error);
	return (
		code === ACTIVE_SESSION_ON_ANOTHER_DEVICE ||
		code === ACTIVE_SESSION_CONFLICT ||
		code === ACTIVE_SESSION_EXISTS
	);
}

/**
 * Checks if the error indicates this session was terminated because another device took over.
 */
export function isSessionReplacedError(error: any): boolean {
	const code = getApiErrorCode(error);
	return code === SESSION_REPLACED_CODE || code === SESSION_REPLACED;
}
