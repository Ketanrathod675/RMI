import Logger from "@/utils/logger";
import { generateUUID } from "@/utils/paymentVerification";
import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import type {
	InitiateRepaymentPayload,
	InitiateRepaymentResponse,
	VerifyRepaymentStatusResponse,
} from "../types/repayment.types";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * REPAYMENT SERVICE
 * Initiates manual repayments and verifies settlement status with the server.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Initiates a manual repayment with the backend.
 * The server picks the active loan and computes the amount.
 * The request model strictly requires ONLY `client_type` in the body.
 */
export const initiateRepayment = async (
	idempotencyKey?: string,
): Promise<InitiateRepaymentResponse> => {
	const headers: Record<string, string> = {
		"Idempotency-Key": idempotencyKey || generateUUID(),
	};

	const payload: InitiateRepaymentPayload = {
		client_type: "app",
	};

	const response = await axios.post<InitiateRepaymentResponse>(
		URLS.repayments.initiate,
		payload,
		{ headers },
	);

	return response.data;
};

/**
 * Verifies repayment payment status by transaction ID.
 * POST repayments/payments/{txnid}/verify-status (no body).
 */
export const verifyRepaymentStatus = async (
	txnid: string,
	options?: { source?: string; timeoutMs?: number; signal?: AbortSignal },
): Promise<VerifyRepaymentStatusResponse> => {
	const response = await axios.post<VerifyRepaymentStatusResponse>(
		URLS.repayments.verify_status(txnid),
		undefined,
		{
			params: options?.source ? { source: options.source } : undefined,
			timeout: options?.timeoutMs,
			signal: options?.signal,
		},
	);

	return response.data;
};

/**
 * Cancels an unattempted repayment payment after checking gateway status.
 * POST repayments/payments/{txnid}/cancel.
 */
export const cancelRepaymentPayment = async (
	txnid: string,
	options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<VerifyRepaymentStatusResponse> => {
	const response = await axios.post<VerifyRepaymentStatusResponse>(
		URLS.repayments.cancel_payment(txnid),
		undefined,
		{
			timeout: options?.timeoutMs,
			signal: options?.signal,
		},
	);

	return response.data;
};

