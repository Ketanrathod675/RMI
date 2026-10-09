import Logger from "@/utils/logger";
import { axios } from "../core/client";
import { URLS } from "../core/endpoints";
import type {
	AssessmentChecks,
	InitiateAssessmentFeePayload,
	InitiateAssessmentFeeResponse,
	PaymentStatusResponse,
	RetryAssessmentChecksPayload,
} from "../types/payment.types";

export { AssessmentChecks, RetryAssessmentChecksPayload };

/**
 * Initiate Assessment Fee Payment
 * POST /payment/initiate-assessment-fee
 */
export const initiateAssessmentFee = async (
	payload: InitiateAssessmentFeePayload,
): Promise<InitiateAssessmentFeeResponse> => {
	const response = await axios.post<InitiateAssessmentFeeResponse>(
		URLS.payments.initiate_assessment_fee,
		{
			lead_id: payload.lead_id,
			phone_no: payload.phone_no,
			firstname: payload.firstname,
			email: payload.email,
			coupon_code: payload.coupon_code ? payload.coupon_code.trim().toUpperCase() : null,
			client_type: payload.client_type ?? "app",
		},
	);
	return response.data;
};

/**
 * Check Easebuzz Payment Status
 * POST /payment/verify-status/{txnid}
 */
export const checkPaymentStatus = async (
	txnid: string,
): Promise<PaymentStatusResponse> => {
	const response = await axios.post<PaymentStatusResponse>(
		URLS.payments.verify_status(txnid),
	);
	return response.data;
};

/**
 * Normalise assessment checks response into a consistent contract.
 * Tolerates both the v2 target backend contract (clean status) and older/intermediate backend shapes.
 */
export const normalizeAssessmentChecks = (raw: any): AssessmentChecks => {
	if (!raw || typeof raw !== "object") {
		return {
			status: "pending",
			failed_rule: null,
			can_update_email: false,
			can_update_pan: false,
			remaining_email_updates: 0,
			remaining_pan_updates: 0,
		};
	}

	let status: "pending" | "approved" | "rejected" | "error" = "pending";

	if (raw.status && typeof raw.status === "string") {
		const s = raw.status.toLowerCase().trim();
		if (s === "approved" || s === "rejected" || s === "error" || s === "pending") {
			status = s as any;
		} else if (s === "success") {
			status = "approved";
		} else if (s === "failed" || s === "fail") {
			status = "error";
		}
	} else {
		// Older backend shape derivation:
		// NEVER treat is_rejected_during_rapid_money_assessment: "No" as approval (it's default while pending).
		const initialCreated = Boolean(raw.initial_payload_created);
		const breDecision = raw.bre_decision ? String(raw.bre_decision).toUpperCase().trim() : "";

		if (!initialCreated || !breDecision) {
			status = "pending";
		} else if (breDecision === "REJECTED") {
			status = "rejected";
		} else if (breDecision === "APPROVED") {
			if (raw.handshake_success === false) {
				status = "error";
			} else {
				status = "approved";
			}
		} else {
			status = "pending";
		}
	}

	const validFailedRules = ["age", "pin_code", "email", "pan_card", "bureau"] as const;
	let failed_rule: AssessmentChecks["failed_rule"] = null;
	if (raw.failed_rule && typeof raw.failed_rule === "string") {
		const fr = raw.failed_rule.toLowerCase().trim();
		if (validFailedRules.includes(fr as any)) {
			failed_rule = fr as any;
		}
	}

	const can_update_email = Boolean(raw.can_update_email);
	const can_update_pan = Boolean(raw.can_update_pan);

	const remaining_email_updates =
		typeof raw.remaining_email_updates === "number"
			? raw.remaining_email_updates
			: can_update_email
				? 1
				: 0;

	const remaining_pan_updates =
		typeof raw.remaining_pan_updates === "number"
			? raw.remaining_pan_updates
			: can_update_pan
				? 1
				: 0;

	return {
		status,
		failed_rule,
		message: raw.message || raw.msg || undefined,
		handshake_success:
			typeof raw.handshake_success === "boolean" ? raw.handshake_success : null,
		lender_lead_id: raw.lender_lead_id ? String(raw.lender_lead_id) : null,
		can_update_email,
		can_update_pan,
		remaining_email_updates,
		remaining_pan_updates,
	};
};

/**
 * Fetch Handshake / BRE Status
 * GET /payment/handshake-status?txnid={txnid}
 */
export const getHandshakeStatus = async (txnid?: string): Promise<AssessmentChecks> => {
	Logger.debug("Fetching handshake status", txnid ? { txnid } : {});
	const response = await axios.get(URLS.payments.handshake_status, {
		params: txnid ? { txnid } : undefined,
	});
	const raw = response.data?.data || response.data;
	return normalizeAssessmentChecks(raw);
};

/**
 * Retry Assessment Checks after updating email or PAN
 * POST /payment/retry-assessment-checks
 */
export const retryAssessmentChecks = async (
	payload: RetryAssessmentChecksPayload,
): Promise<AssessmentChecks> => {
	Logger.debug("Retrying assessment checks", { lead_id: payload.lead_id });
	const body: Record<string, any> = {
		lead_id: payload.lead_id,
		retry_email: true,
		retry_pan: true,
		max_retries: 1,
	};
	if (payload.txnid) {
		body.txnid = payload.txnid;
	}
	if (payload.updated_email) {
		body.updated_email = payload.updated_email.trim().toLowerCase();
	}
	if (payload.updated_pan) {
		body.updated_pan = payload.updated_pan.trim().toUpperCase();
	}

	try {
		const response = await axios.post(URLS.payments.retry_assessment_checks, body);
		const raw = response.data?.data || response.data;
		return normalizeAssessmentChecks(raw);
	} catch (error: any) {
		const rawDetail =
			error?.response?.data?.detail ||
			error?.response?.data?.message ||
			error?.message ||
			"Failed to retry assessment checks";
		const detailStr =
			typeof rawDetail === "string" ? rawDetail : JSON.stringify(rawDetail);
		const err = new Error(detailStr) as any;
		err.detail = detailStr;
		err.status = error?.response?.status;
		throw err;
	}
};
