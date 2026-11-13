import { decode, encode } from "@/utils/encode_decode";
import { getStorageItem, removeStorageItem, setStorageItem, STORAGE_KEYS } from "@/utils/storage";

export interface RateLimitInfo {
	isRateLimited: boolean;
	retryAfterSeconds: number; // always >= 1
	serverMessage: string; // raw backend detail, for logging only. NEVER show to the user
}

export interface OtpLockState {
	until: number;
	remainingSeconds: number;
	phone?: string;
}

const MIN_RETRY_SECONDS = 1;
const MAX_RETRY_SECONDS = 3600;
const DEFAULT_RETRY_SECONDS = 60;

function clampSeconds(seconds: number): number {
	if (!Number.isFinite(seconds)) return DEFAULT_RETRY_SECONDS;
	return Math.min(MAX_RETRY_SECONDS, Math.max(MIN_RETRY_SECONDS, Math.round(seconds)));
}

function extractRawServerMessage(err: any): string {
	const detail = err?.response?.data?.detail ?? err?.detail;
	if (typeof detail === "string" && detail.trim()) {
		return detail.trim();
	}
	if (detail && typeof detail === "object") {
		if (typeof detail.message === "string" && detail.message.trim()) {
			return detail.message.trim();
		}
		if (typeof detail.msg === "string" && detail.msg.trim()) {
			return detail.msg.trim();
		}
	}
	if (Array.isArray(detail)) {
		const joined = detail
			.map((item) => (typeof item === "string" ? item : item?.msg || item?.message))
			.filter((val): val is string => typeof val === "string" && val.trim().length > 0)
			.join(" ")
			.trim();
		if (joined) return joined;
	}
	const topMessage = err?.response?.data?.message ?? err?.message;
	if (typeof topMessage === "string" && topMessage.trim()) {
		return topMessage.trim();
	}
	return "";
}

function readRetryAfterHeader(headers: any): unknown {
	if (!headers) return undefined;
	if (typeof headers.get === "function") {
		const val = headers.get("retry-after") ?? headers.get("Retry-After");
		if (val !== undefined && val !== null) return val;
	}
	if (typeof headers === "object") {
		for (const key of Object.keys(headers)) {
			if (key.toLowerCase() === "retry-after") {
				return headers[key];
			}
		}
	}
	return undefined;
}

function parseRetryAfterValue(raw: unknown): number | null {
	if (raw === undefined || raw === null) return null;
	if (typeof raw === "number") {
		return Number.isFinite(raw) ? raw : null;
	}
	if (typeof raw !== "string") return null;

	const trimmed = raw.trim();
	if (!trimmed) return null;

	if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : null;
	}

	const timestampMs = Date.parse(trimmed);
	if (!Number.isNaN(timestampMs)) {
		return Math.ceil((timestampMs - Date.now()) / 1000);
	}

	return null;
}

function parseSecondsFromText(text: string): number | null {
	if (!text) return null;
	const secMatch = text.match(/(\d+)\s*seconds?/i);
	if (secMatch) {
		const secs = parseInt(secMatch[1], 10);
		if (Number.isFinite(secs)) return secs;
	}
	const minMatch = text.match(/(\d+)\s*minutes?/i);
	if (minMatch) {
		const mins = parseInt(minMatch[1], 10);
		if (Number.isFinite(mins)) return mins * 60;
	}
	return null;
}

/**
 * Inspects an Axios or wrapped service error (e.g. ConsentApiError) for HTTP 429 rate limiting.
 */
export function getRateLimitInfo(err: any): RateLimitInfo {
	const status = err?.response?.status ?? err?.status;
	const serverMessage = extractRawServerMessage(err);

	if (status !== 429) {
		return {
			isRateLimited: false,
			retryAfterSeconds: MIN_RETRY_SECONDS,
			serverMessage,
		};
	}

	const headerVal = readRetryAfterHeader(err?.response?.headers);
	const fromHeader = parseRetryAfterValue(headerVal);
	if (fromHeader !== null) {
		return {
			isRateLimited: true,
			retryAfterSeconds: clampSeconds(fromHeader),
			serverMessage,
		};
	}

	if (typeof err?.retryAfter === "number" && Number.isFinite(err.retryAfter)) {
		return {
			isRateLimited: true,
			retryAfterSeconds: clampSeconds(err.retryAfter),
			serverMessage,
		};
	}

	const fromText = parseSecondsFromText(serverMessage);
	if (fromText !== null) {
		return {
			isRateLimited: true,
			retryAfterSeconds: clampSeconds(fromText),
			serverMessage,
		};
	}

	return {
		isRateLimited: true,
		retryAfterSeconds: DEFAULT_RETRY_SECONDS,
		serverMessage,
	};
}

/**
 * Returns true when a 429 on OTP resend is a normal short cooldown (~30s)
 * rather than an account/phone lockout.
 */
export function isResendCooldownOnly(info: RateLimitInfo): boolean {
	if (!info.isRateLimited) return false;
	if (/locked|too many wrong|too many failed/i.test(info.serverMessage)) {
		return false;
	}
	return (
		info.retryAfterSeconds <= 45 ||
		/wait\s+\d+\s*seconds?|before\s+resending|resend\s+after/i.test(info.serverMessage)
	);
}

/**
 * Returns true when an HTTP 429 means the current OTP was invalidated after wrong attempts
 * and the user must request a new OTP (without an account lockout timer / Retry-After header).
 */
export function isNewOtpRequiredOnly(err: any, info?: RateLimitInfo): boolean {
	const resolved = info ?? getRateLimitInfo(err);
	if (!resolved.isRateLimited) return false;

	const hasExplicitDuration =
		parseRetryAfterValue(readRetryAfterHeader(err?.response?.headers)) !== null ||
		(typeof err?.retryAfter === "number" && Number.isFinite(err.retryAfter)) ||
		parseSecondsFromText(resolved.serverMessage) !== null;
	if (hasExplicitDuration) return false;

	const msg = resolved.serverMessage;
	if (/temporarily\s+locked|phone\s+number\s+is\s+(?:temporarily\s+)?locked|try\s+again\s+(?:after|in)/i.test(msg)) {
		return false;
	}
	return /request\s+(?:a\s+)?new\s+otp/i.test(msg);
}

/**
 * Parses remaining wrong-OTP attempt counts from backend messages like
 * "Invalid OTP. 2 attempt(s) remaining." or "1 attempt left".
 */
export function parseRemainingOtpAttempts(err: any): number | null {
	const raw = extractRawServerMessage(err);
	if (!raw) return null;
	const match = raw.match(/(\d+)\s*attempt(?:\(s\)|s)?\s*(?:remaining|left)/i);
	if (!match) return null;
	const parsed = parseInt(match[1], 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Formats a localized wrong-OTP warning when the backend includes remaining attempts,
 * otherwise returns the supplied fallback message.
 */
export function formatRemainingOtpAttemptsMessage(
	err: any,
	t: (key: any, fallback?: string) => string,
	fallback: string,
): string {
	const attemptsLeft = parseRemainingOtpAttempts(err);
	if (attemptsLeft === 1) {
		return (
			t("lastOtpAttemptWarning") ||
			"Last attempt. Your number will be locked for 15 minutes if this is wrong."
		);
	}
	if (attemptsLeft !== null && attemptsLeft > 1) {
		return (t("wrongOtpAttemptsLeft") || "Wrong OTP. {count} attempts left.").replace(
			"{count}",
			String(attemptsLeft),
		);
	}
	return fallback;
}

/**
 * Formats seconds for user display: "14 min 59 sec", "15 minutes", "45 seconds".
 */
export function formatWaitTime(totalSeconds: number): string {
	const safe = Math.max(0, Math.round(totalSeconds));
	if (safe < 60) {
		return `${safe} ${safe === 1 ? "second" : "seconds"}`;
	}
	const mins = Math.floor(safe / 60);
	const secs = safe % 60;
	if (secs === 0) {
		return `${mins} ${mins === 1 ? "minute" : "minutes"}`;
	}
	return `${mins} min ${secs} sec`;
}

function normalizePhone(phone: string): string {
	const trimmed = phone.trim();
	const digits = trimmed.replace(/\D/g, "");
	return digits.length >= 10 ? digits.slice(-10) : trimmed;
}

/**
 * Persists an OTP lock timestamp for the given phone under @otp-lock (phone is encoded).
 */
export async function saveOtpLock(phone: string, retryAfterSeconds: number): Promise<void> {
	const normalized = normalizePhone(phone);
	if (!normalized) return;
	const safeSeconds = clampSeconds(retryAfterSeconds);
	const until = Date.now() + safeSeconds * 1000;
	const payload = JSON.stringify({
		phone: encode(normalized),
		until,
	});
	await setStorageItem(STORAGE_KEYS["@otp-lock"], payload);
}

/**
 * Reads an active OTP lock from storage. Removes expired or malformed entries.
 * If phone is provided and does not match the locked phone, returns null without clearing.
 */
export async function getOtpLock(phone?: string): Promise<OtpLockState | null> {
	try {
		const raw = await getStorageItem(STORAGE_KEYS["@otp-lock"]);
		if (!raw) return null;

		const parsed = JSON.parse(raw) as { phone?: string; until?: number } | null;
		if (!parsed || typeof parsed.until !== "number" || typeof parsed.phone !== "string") {
			await removeStorageItem(STORAGE_KEYS["@otp-lock"]);
			return null;
		}

		const remainingMs = parsed.until - Date.now();
		if (remainingMs <= 0) {
			await removeStorageItem(STORAGE_KEYS["@otp-lock"]);
			return null;
		}

		const storedPhone = normalizePhone(decode(parsed.phone));
		if (phone !== undefined && phone.trim().length > 0) {
			const requestedPhone = normalizePhone(phone);
			if (storedPhone !== requestedPhone) {
				return null;
			}
		}

		return {
			until: parsed.until,
			remainingSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
			phone: storedPhone,
		};
	} catch {
		await removeStorageItem(STORAGE_KEYS["@otp-lock"]).catch(() => {});
		return null;
	}
}

/**
 * Clears any persisted OTP lock.
 */
export async function clearOtpLock(): Promise<void> {
	await removeStorageItem(STORAGE_KEYS["@otp-lock"]);
}
