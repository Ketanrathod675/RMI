/**
 * Shared verification helpers for payment polling engines.
 * Used by repayment hooks and screens.
 */

export type Classified =
	| "SUCCESS"
	| "FAILED"
	| "CANCELLED"
	| "EXPIRED"
	| "PENDING"
	| "ERROR";

export const classify = (
	res: any,
): { kind: Classified; notStarted: boolean } => {
	const raw = String(res?.data?.status ?? res?.status ?? "").toUpperCase();
	const reason = res?.data?.reason ?? res?.reason;
	const notStarted = reason === "not_started";

	if (["COMPLETED", "SUCCESS", "PAID", "WAIVED"].includes(raw)) {
		return { kind: "SUCCESS", notStarted };
	}
	if (["FAILED", "FAILURE", "REJECTED", "DROPPED", "BOUNCED"].includes(raw)) {
		return { kind: "FAILED", notStarted };
	}
	if (["CANCELLED", "CANCELED", "USERCANCELLED"].includes(raw)) {
		return { kind: "CANCELLED", notStarted };
	}
	if (raw === "EXPIRED") {
		return { kind: "EXPIRED", notStarted };
	}
	return { kind: "PENDING", notStarted };
};

export const withTimeout = <T,>(
	promise: Promise<T>,
	timeoutMs: number,
	fallback: T,
): Promise<T> =>
	new Promise((resolve) => {
		const timer = setTimeout(() => resolve(fallback), Math.max(0, timeoutMs));
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			() => {
				clearTimeout(timer);
				resolve(fallback);
			},
		);
	});

export type VerifySource =
	| "deeplink_success"
	| "deeplink_failure"
	| "browser_closed"
	| "manual";

export const REPAYMENT_WINDOW_MS: Record<VerifySource, number> = {
	deeplink_success: 90_000,
	deeplink_failure: 8_000,
	browser_closed: 10_000,
	manual: 30_000,
};

export const REPAYMENT_POLL_INTERVAL_MS = 4000;

export function generateUUID(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

