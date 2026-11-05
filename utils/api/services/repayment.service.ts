import Logger from "@/utils/logger";
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
	const headers: Record<string, string> = {};
	if (idempotencyKey) {
		headers["Idempotency-Key"] = idempotencyKey;
	}

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
	options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<VerifyRepaymentStatusResponse> => {
	const response = await axios.post<VerifyRepaymentStatusResponse>(
		URLS.repayments.verify_status(txnid),
		undefined,
		{
			timeout: options?.timeoutMs,
			signal: options?.signal,
		},
	);

	return response.data;
};

