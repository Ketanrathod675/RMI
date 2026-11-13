import {
	clearIdempotencyKey,
	getOrCreateIdempotencyKey,
	updateIdempotencyKeyMeta,
} from "@/utils/idempotency";
import { getStorageItem, removeStorageItem, STORAGE_KEYS } from "@/utils/storage";

const REPAYMENT_IDEM_SCOPE = "repayment";

/**
 * Migrates the legacy "@repayment-idempotency-key" storage entry:
 * any legacy plain string value is treated as expired and deleted on first read.
 */
export async function migrateLegacyRepaymentKey(): Promise<void> {
	try {
		const legacyVal = await getStorageItem(STORAGE_KEYS["@repayment-idempotency-key"]);
		if (legacyVal !== null) {
			await removeStorageItem(STORAGE_KEYS["@repayment-idempotency-key"]);
		}
	} catch {
		// Ignore migration errors
	}
}

/**
 * Returns an active idempotency key for repayment scoped by amount_to_repay,
 * migrating/discarding any legacy plain-string key and rotating on amount change or expiry.
 */
export async function getOrCreateRepaymentIdempotencyKey(
	amount?: number | string | null,
): Promise<string> {
	await migrateLegacyRepaymentKey();
	const fingerprint = amount !== undefined && amount !== null ? String(amount) : "";
	const key = await getOrCreateIdempotencyKey(REPAYMENT_IDEM_SCOPE, fingerprint);
	const numericAmount =
		typeof amount === "number"
			? amount
			: typeof amount === "string" && amount.trim() !== "" && !Number.isNaN(Number(amount))
				? Number(amount)
				: undefined;
	if (numericAmount !== undefined) {
		await updateIdempotencyKeyMeta(REPAYMENT_IDEM_SCOPE, { amount: numericAmount });
	}
	return key;
}

/**
 * Records the backend's expires_at timestamp on the repayment idempotency entry.
 */
export async function saveRepaymentKeyExpiry(
	expiresAtIso?: string | null,
	amount?: number,
): Promise<void> {
	const meta: { expiresAt?: number; amount?: number } = {};
	if (typeof amount === "number" && Number.isFinite(amount)) {
		meta.amount = amount;
	}
	if (expiresAtIso) {
		const parsedMs = Date.parse(expiresAtIso);
		if (!Number.isNaN(parsedMs)) {
			meta.expiresAt = parsedMs;
		}
	}
	if (meta.expiresAt !== undefined || meta.amount !== undefined) {
		await updateIdempotencyKeyMeta(REPAYMENT_IDEM_SCOPE, meta);
	}
}

export type Repayment409Kind = "conflict_retry" | "in_progress" | "none";

function extractDetailText(detail: unknown): string {
	if (typeof detail === "string") return detail.toLowerCase();
	if (detail && typeof detail === "object") {
		const obj = detail as Record<string, unknown>;
		const msg = typeof obj.message === "string" ? obj.message : typeof obj.detail === "string" ? obj.detail : "";
		if (msg) return msg.toLowerCase();
		return JSON.stringify(detail).toLowerCase();
	}
	return "";
}

/**
 * Classifies 409/active errors from POST /repayments/initiate-manual-payment.
 */
export function classifyRepaymentInitiate409(err: any): Repayment409Kind {
	const status = err?.response?.status ?? err?.status;
	const detailStr = extractDetailText(err?.response?.data?.detail ?? err?.response?.data?.message);

	if (status === 409) {
		if (
			detailStr.includes("idempotency key conflict") ||
			detailStr.includes("link expired or inactive")
		) {
			return "conflict_retry";
		}
		if (
			detailStr.includes("pending") ||
			detailStr.includes("in progress") ||
			detailStr.includes("in_progress") ||
			detailStr.includes("in flight") ||
			detailStr.includes("bank confirmation") ||
			detailStr.includes("verify its status") ||
			detailStr.includes("active repayment")
		) {
			return "in_progress";
		}
		return "conflict_retry";
	}

	if (detailStr.includes("active") || detailStr.includes("in progress") || detailStr.includes("in_progress")) {
		return "in_progress";
	}

	return "none";
}

export type RepaymentInitiateInterpretation =
	| {
			kind: "already_paid";
			txnid?: string;
			amount?: unknown;
			expiresAt?: string | null;
	  }
	| {
			kind: "open_url";
			txnid: string;
			paymentUrl: string;
			resumed: boolean;
			amount?: unknown;
			expiresAt?: string | null;
	  }
	| { kind: "invalid" };

/**
 * Normalizes and interprets POST /repayments/initiate-manual-payment response.
 * Supports both flat backend responses and wrapped `{ data }` mock/legacy responses.
 */
export function interpretRepaymentInitiateResponse(
	rawRes: any,
): RepaymentInitiateInterpretation {
	const payload = rawRes?.data?.txnid ? rawRes.data : rawRes;
	if (!payload || typeof payload !== "object") {
		return { kind: "invalid" };
	}

	const txnid = payload.txnid ? String(payload.txnid) : undefined;
	const statusUpper = String(payload.status ?? "").trim().toUpperCase();
	const isAlreadyPaid = Boolean(payload.already_paid) || statusUpper === "SUCCESS";

	if (isAlreadyPaid) {
		return {
			kind: "already_paid",
			txnid,
			amount: payload.amount,
			expiresAt: payload.expires_at ?? null,
		};
	}

	const paymentUrl = payload.payment_url;
	if (
		typeof paymentUrl === "string" &&
		paymentUrl.startsWith("https://") &&
		txnid
	) {
		return {
			kind: "open_url",
			txnid,
			paymentUrl,
			resumed: Boolean(payload.resumed),
			amount: payload.amount,
			expiresAt: payload.expires_at ?? null,
		};
	}

	return { kind: "invalid" };
}

/**
 * Clears all stored manual repayment tracking & idempotency keys.
 */
export async function clearStoredRepaymentKeys(): Promise<void> {
	await Promise.all([
		removeStorageItem(STORAGE_KEYS["@repayment-txnid"]).catch(() => {}),
		removeStorageItem(STORAGE_KEYS["@repayment-timestamp"]).catch(() => {}),
		removeStorageItem(STORAGE_KEYS["@repayment-amount-before"]).catch(() => {}),
		removeStorageItem(STORAGE_KEYS["@repayment-idempotency-key"]).catch(() => {}),
		clearIdempotencyKey(REPAYMENT_IDEM_SCOPE).catch(() => {}),
	]);
}

/**
 * Calls initiateFn with a scoped repayment idempotency key; on 409 conflict or expired link,
 * clears the key, creates a fresh key, and retries ONCE automatically.
 */
export async function initiateRepaymentWithConflictRetry<T>({
	amount,
	initiateFn,
}: {
	amount?: number | string | null;
	initiateFn: (idempotencyKey: string) => Promise<T>;
}): Promise<T> {
	const key = await getOrCreateRepaymentIdempotencyKey(amount);
	try {
		return await initiateFn(key);
	} catch (err: any) {
		if (classifyRepaymentInitiate409(err) === "conflict_retry") {
			await clearIdempotencyKey(REPAYMENT_IDEM_SCOPE);
			const freshKey = await getOrCreateRepaymentIdempotencyKey(amount);
			return await initiateFn(freshKey);
		}
		throw err;
	}
}

